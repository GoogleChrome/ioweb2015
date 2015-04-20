package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"time"

	"golang.org/x/net/context"
)

const (
	searchDriveFiles = "'appfolder' in parents and title = '%s' and trashed = false"

	// appDataCacheTimeout is how long until cached appdata is expired.
	appDataCacheTimeout = 4 * time.Hour
)

type appFolderData struct {
	// id indicates whether the file exists
	Id string `json:"id"`

	GCMKey    string   `json:"gcm_key"`
	Bookmarks []string `json:"starred_sessions"`
	Videos    []string `json:"viewed_videos"`
	Feedback  []string `json:"feedback_submitted_sessions"`
}

// getAppFolderData retrieves AppFolder data for user uid either from cache or network.
// User credentials are required on network requests.
func getAppFolderData(c context.Context, uid string) (*appFolderData, error) {
	data, err := appFolderDataFromCache(c, uid)
	if err == nil {
		return data, nil
	}
	cred, err := getCredentials(c, uid)
	if err != nil {
		return nil, err
	}
	data, err = fetchAppFolderData(c, cred)
	if err != nil {
		return nil, err
	}
	cacheAppFolderData(c, uid, data)
	return data, nil
}

// appFolderDataFromCache retrieves AppFolder cached data.
func appFolderDataFromCache(c context.Context, uid string) (*appFolderData, error) {
	b, err := cache.get(c, appFolderCacheKey(uid))
	if err != nil {
		return nil, err
	}
	data := &appFolderData{}
	return data, json.Unmarshal(b, data)
}

// cacheAppFolderData updates cached version of AppFolder data.
// It will retry a few times on cache errors before giving up.
func cacheAppFolderData(c context.Context, uid string, data *appFolderData) error {
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	k := appFolderCacheKey(uid)
	for r := 1; r < 4; r++ {
		err = cache.set(c, k, b, appDataCacheTimeout)
		if err == nil {
			return nil
		}
		errorf(c, "cacheAppFolderData(%s): %v; retry = %d", uid, err, r)
	}
	errorf(c, "cacheAppFolderData(%s): giving up")
	return err
}

// fetchAppFolderData retrieves AppFolder data using Google Drive API.
// It fetches data from Google Drive AppData folder associated with config.Google.Auth.Client.
func fetchAppFolderData(c context.Context, cred *oauth2Credentials) (*appFolderData, error) {
	// list files in 'appfolder' with title 'user_data.json'
	// TODO: cache appdata file ID so not to query every time.
	hc := oauth2Client(c, cred.tokenSource(c))
	params := url.Values{
		"q":          {fmt.Sprintf(searchDriveFiles, config.Google.Drive.Filename)},
		"fields":     {"nextPageToken,items(id,downloadUrl,modifiedDate)"},
		"maxResults": {"100"},
	}
	res, err := hc.Get(config.Google.Drive.FilesURL + "?" + params.Encode())
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetchAppFolderData: %s", res.Status)
	}

	// find the most recently updated user_data.json in case there are many
	var body struct {
		NextPageToken string `json:"nextPageToken"`
		Items         []struct {
			ID           string `json:"id"`
			ModifiedDate string `json:"modifiedDate"`
			DownloadURL  string `json:"downloadUrl"`
		} `json:"items"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("fetchAppFolderData: %v", err)
	}

	var fileID, fileURL string
	var mdate time.Time

	for _, item := range body.Items {
		t, err := time.Parse(time.RFC3339Nano, item.ModifiedDate)
		if err != nil {
			continue
		}
		if t.After(mdate) && item.DownloadURL != "" {
			mdate = t
			fileID = item.ID
			fileURL = item.DownloadURL
		}
	}

	// get the file contents or return an empty if none exists
	data := &appFolderData{}

	if fileURL == "" {
		logf(c, "fetchAppFolderData: file not found")
		return data, nil
	}

	if res, err = hc.Get(fileURL); err != nil {
		return nil, err
	}
	defer res.Body.Close()
	data.Id = fileID
	return data, json.NewDecoder(res.Body).Decode(data)
}

// storeAppFolderData saves appdata using Google Drive API and updates cached content.
// It also notifies iosched app about the updates.
func storeAppFolderData(c context.Context, uid string, data *appFolderData) error {
	// TODO: make cred be available in context c.
	cred, err := getCredentials(c, uid)
	if err != nil {
		return err
	}
	// request payload
	var body bytes.Buffer
	mp := multipart.NewWriter(&body)

	// metadata
	pw, err := mp.CreatePart(typeMimeHeader("application/json"))
	if err != nil {
		return err
	}
	meta := fmt.Sprintf(`{
    "title": %q,
    "mimeType": "application/json",
    "parents": [{"id": "appfolder"}]
  }`, config.Google.Drive.Filename)
	pw.Write([]byte(meta))

	// media content
	pw, err = mp.CreatePart(typeMimeHeader("application/json"))
	if err != nil {
		return err
	}
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	pw.Write(b)
	mp.Close()

	// construct HTTP request
	m, url := "POST", config.Google.Drive.UploadURL
	if data.Id != "" {
		m = "PUT"
		url += "/" + data.Id
	}
	r, err := http.NewRequest(m, url+"?uploadType=multipart", &body)
	if err != nil {
		return err
	}
	r.Header.Set("Content-Type", "multipart/related; boundary="+mp.Boundary())

	// make the actual request
	res, err := oauth2Client(c, cred.tokenSource(c)).Do(r)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode > 299 {
		return errors.New("storeAppFolderData: " + res.Status)
	}

	// If the above request to gdrive API succeds but the cache fails,
	// we have no easy way to rollback and thus there's no point in checking
	// for returned error value.
	// In the worst case scenario users will see stale data
	// for a max of appDataCacheTimeout.
	cacheAppFolderData(c, uid, data)

	// TODO: ping iosched about updated file
	return nil
}

// appFolderCacheKey returns a cache key for a user uid.
func appFolderCacheKey(uid string) string {
	return "appdata:" + uid
}

// typeMimeHeader returns Content-Type header in MIMEHeader format,
// set to provided contentType.
func typeMimeHeader(contentType string) textproto.MIMEHeader {
	h := make(textproto.MIMEHeader)
	h.Set("Content-Type", contentType)
	return h
}
