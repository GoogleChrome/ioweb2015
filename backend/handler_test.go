package main

import (
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestServeIOExtEntriesStub(t *testing.T) {
	defer resetTestState(t)
	r := newTestRequest(t, "GET", "/api/v1/extended", nil)
	w := httptest.NewRecorder()
	serveIOExtEntries(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("GET %s: %d; want %d", r.URL.String(), w.Code, http.StatusOK)
	}
	ctype := "application/json;charset=utf-8"
	if w.Header().Get("Content-Type") != ctype {
		t.Errorf("Content-Type: %q; want %q", w.Header().Get("Content-Type"), ctype)
	}
}

func TestServeSocialStub(t *testing.T) {
	defer resetTestState(t)
	r := newTestRequest(t, "GET", "/api/v1/social", nil)
	w := httptest.NewRecorder()
	serveSocial(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want %d", w.Code, http.StatusOK)
	}
	ctype := "application/json;charset=utf-8"
	if v := w.Header().Get("Content-Type"); v != ctype {
		t.Errorf("Content-Type: %q; want %q", v, ctype)
	}
}

func TestServeScheduleStub(t *testing.T) {
	defer resetTestState(t)
	defer preserveConfig()
	config.Env = "dev"

	r := newTestRequest(t, "GET", "/api/v1/schedule", nil)
	w := httptest.NewRecorder()
	serveSchedule(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want %d", w.Code, http.StatusOK)
	}
	etag := w.Header().Get("etag")
	if etag == "" || etag == `""` {
		t.Fatalf("etag = %q; want non-empty", etag)
	}

	r = newTestRequest(t, "GET", "/api/v1/schedule", nil)
	r.Header.Set("if-none-match", etag)
	w = httptest.NewRecorder()
	serveSchedule(w, r)

	if w.Code != http.StatusNotModified {
		t.Errorf("w.Code = %d; want %d", w.Code, http.StatusNotModified)
	}
}

func TestServeSchedule(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()
	config.Env = "prod"
	r := newTestRequest(t, "GET", "/api/v1/schedule", nil)
	c := newContext(r)

	checkRes := func(n int, w *httptest.ResponseRecorder, code int, hasEtag bool) string {
		if w.Code != code {
			t.Errorf("%d: w.Code = %d; want %d", n, w.Code, code)
		}
		etag := w.Header().Get("etag")
		if hasEtag && (etag == "" || etag == `""`) {
			t.Errorf("%d: etag = %q; want non-empty", n, etag)
		}
		if !hasEtag && etag != `""` {
			t.Errorf("%d: etag = %q; want %q", n, etag, `""`)
		}
		return etag
	}

	// no etag
	w := httptest.NewRecorder()
	serveSchedule(w, r)
	checkRes(1, w, http.StatusOK, false)

	// first etag
	if err := storeEventData(c, &eventData{modified: time.Now()}); err != nil {
		t.Fatal(err)
	}
	w = httptest.NewRecorder()
	serveSchedule(w, r)
	etag := checkRes(2, w, http.StatusOK, true)

	r.Header.Set("if-none-match", etag)
	w = httptest.NewRecorder()
	serveSchedule(w, r)
	checkRes(3, w, http.StatusNotModified, true)

	// new etag
	if err := storeEventData(c, &eventData{modified: time.Now()}); err != nil {
		t.Fatal(err)
	}
	w = httptest.NewRecorder()
	serveSchedule(w, r)
	etag = checkRes(4, w, http.StatusOK, true)

	w = httptest.NewRecorder()
	r.Header.Set("if-none-match", etag)
	serveSchedule(w, r)
	checkRes(5, w, http.StatusNotModified, true)

	// star etag
	w = httptest.NewRecorder()
	r.Header.Set("if-none-match", "*")
	serveSchedule(w, r)
	lastEtag := checkRes(5, w, http.StatusOK, true)
	if lastEtag != etag {
		t.Errorf("lastEtag = %q; want %q", lastEtag, etag)
	}
}

func TestServeTemplate(t *testing.T) {
	defer resetTestState(t)
	const ctype = "text/html;charset=utf-8"

	revert := preserveConfig()
	defer revert()
	config.Prefix = "/root"

	table := []struct{ path, slug, canonical string }{
		{"/", "home", "/root/"},
		{"/home?experiment", "home", "/root/"},
		{"/about", "about", "/root/about"},
		{"/about?experiment", "about", "/root/about"},
		{"/schedule", "schedule", "/root/schedule"},
		{"/onsite", "onsite", "/root/onsite"},
		{"/offsite", "offsite", "/root/offsite"},
		{"/registration", "registration", "/root/registration"},
		{"/faq", "faq", "/root/faq"},
		{"/form", "form", "/root/form"},
	}
	for i, test := range table {
		r := newTestRequest(t, "GET", test.path, nil)
		w := httptest.NewRecorder()
		serveTemplate(w, r)

		if w.Code != http.StatusOK {
			t.Errorf("%d: GET %s = %d; want %d", i, test.path, w.Code, http.StatusOK)
			continue
		}
		if v := w.Header().Get("Content-Type"); v != ctype {
			t.Errorf("%d: Content-Type: %q; want %q", i, v, ctype)
		}
		if w.Header().Get("Cache-Control") == "" {
			t.Errorf("%d: want cache-control header", i)
		}

		body := string(w.Body.String())

		tag := `<body id="page-` + test.slug + `"`
		if !strings.Contains(body, tag) {
			t.Errorf("%d: %s does not contain %s", i, body, tag)
		}
		tag = `<link rel="canonical" href="` + test.canonical + `"`
		if !strings.Contains(body, tag) {
			t.Errorf("%d: %s does not contain %s", i, body, tag)
		}
	}
}

func TestServeTemplateRedirect(t *testing.T) {
	defer resetTestState(t)
	table := []struct{ start, redirect string }{
		{"/about/", "/about"},
		{"/one/two/", "/one/two"},
	}
	for i, test := range table {
		r := newTestRequest(t, "GET", test.start, nil)
		w := httptest.NewRecorder()
		serveTemplate(w, r)

		if w.Code != http.StatusFound {
			t.Fatalf("%d: GET %s: %d; want %d", i, test.start, w.Code, http.StatusFound)
		}
		redirect := config.Prefix + test.redirect
		if loc := w.Header().Get("Location"); loc != redirect {
			t.Errorf("%d: Location: %q; want %q", i, loc, redirect)
		}
	}
}

func TestServeTemplate404(t *testing.T) {
	defer resetTestState(t)
	r := newTestRequest(t, "GET", "/a-thing-that-is-not-there", nil)
	w := httptest.NewRecorder()
	serveTemplate(w, r)
	if w.Code != http.StatusNotFound {
		t.Errorf("GET %s: %d; want %d", r.URL.String(), w.Code, http.StatusNotFound)
	}
	const ctype = "text/html;charset=utf-8"
	if v := w.Header().Get("Content-Type"); v != ctype {
		t.Errorf("Content-Type: %q; want %q", v, ctype)
	}
	if v := w.Header().Get("Cache-Control"); v != "" {
		t.Errorf("don't want Cache-Control: %q", v)
	}
}

func TestHandleAuth(t *testing.T) {
	defer resetTestState(t)
	defer preserveConfig()()
	const code = "fake-auth-code"

	table := []struct {
		token            string
		doExchange       bool
		exchangeRespCode int
		success          bool
	}{
		{"valid", true, http.StatusOK, true},
		{"valid", true, http.StatusBadRequest, false},
		{"", false, http.StatusOK, false},
		{testIDToken, true, http.StatusOK, true},
		{testIDToken, true, http.StatusBadRequest, false},
	}

	for i, test := range table {
		resetTestState(t)

		done := make(chan struct{}, 1)
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if v := r.FormValue("code"); v != code {
				t.Errorf("code = %q; want %q", v, code)
			}
			if v := r.FormValue("client_id"); v != testClientID {
				t.Errorf("client_id = %q; want %q", v, testClientID)
			}
			if v := r.FormValue("client_secret"); v != testClientSecret {
				t.Errorf("client_secret = %q; want %q", v, testClientSecret)
			}
			if v := r.FormValue("redirect_uri"); v != "postmessage" {
				t.Errorf("redirect_uri = %q; want postmessage", v)
			}
			if v := r.FormValue("grant_type"); v != "authorization_code" {
				t.Errorf("grant_type = %q; want authorization_code", v)
			}

			w.WriteHeader(test.exchangeRespCode)
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{
				"access_token": "new-access-token",
				"refresh_token": "new-refresh-token",
				"id_token": %q,
				"expires_in": 3600
			}`, testIDToken)

			done <- struct{}{}
		}))
		defer ts.Close()
		config.Google.TokenURL = ts.URL

		p := strings.NewReader(`{"code": "` + code + `"}`)
		r := newTestRequest(t, "POST", "/api/v1/auth", p)
		r.Header.Set("Authorization", "Bearer "+test.token)
		w := httptest.NewRecorder()
		c := newContext(r)

		cache.flush(c)
		handleAuth(w, r)

		if test.success && w.Code != http.StatusOK {
			t.Errorf("%d: code = %d; want 200\nbody: %s", i, w.Code, w.Body.String())
		} else if !test.success && w.Code == http.StatusOK {
			t.Errorf("%d: code = 200; want > 399\nbody: %s", i, w.Body)
		}

		select {
		case <-done:
			if !test.doExchange {
				t.Errorf("%d: should not have done code exchange", i)
			}
		default:
			if test.doExchange {
				t.Errorf("%d: code exchange never happened", i)
			}
		}

		// TODO: remove !isGAEtest when standalone DB is implemented
		if !test.success || !isGAEtest {
			continue
		}

		cred, err := getCredentials(c, testUserID)

		if err != nil {
			t.Errorf("%d: getCredentials: %v", i, err)
		}
		if cred.AccessToken != "new-access-token" {
			t.Errorf("%d: cred.AccessToken = %q; want 'new-access-token'", i, cred.AccessToken)
		}
		if cred.RefreshToken != "new-refresh-token" {
			t.Errorf("%d: cred.RefreshToken = %q; want 'new-refresh-token'", i, cred.RefreshToken)
		}
		if cred.Expiry.Before(time.Now()) {
			t.Errorf("%d: cred.Expiry is in the past: %s", i, cred.Expiry)
		}
	}
}

func TestServeUserScheduleCache(t *testing.T) {
	defer resetTestState(t)
	defer preserveConfig()()
	config.Google.Drive.FilesURL = "invalid"

	c := newContext(newTestRequest(t, "GET", "/dummy", nil))
	cache.flush(c)
	cacheAppFolderData(c, testUserID, &appFolderData{
		Bookmarks: []string{"sid"},
	})

	r := newTestRequest(t, "GET", "/api/v1/user/schedule", nil)
	r.Header.Set("authorization", bearerHeader+testIDToken)
	w := httptest.NewRecorder()
	serveUserSchedule(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("w.Code = %d; want 200\nResponse: %s", w.Code, w.Body.String())
	}

	var list []string
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0] != "sid" {
		t.Errorf("list = %v; want ['sid']", list)
	}
}

func TestServeUserScheduleAndExpiredToken(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	c := newContext(newTestRequest(t, "GET", "/dummy", nil))
	if err := storeCredentials(c, &oauth2Credentials{
		userID:       testUserID,
		Expiry:       time.Now().Add(-1 * time.Hour),
		AccessToken:  "access-token",
		RefreshToken: "refresh-token",
	}); err != nil {
		t.Fatal(err)
	}

	// Refresh token server stub
	tokens := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
      "access_token":"new-access",
      "expires_in":3600,
      "token_type":"Bearer"
    }`))
	}))
	defer tokens.Close()
	config.Google.TokenURL = tokens.URL

	// Google Drive stub
	var gdrive *httptest.Server
	gdrive = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ah := r.Header.Get("authorization")
		if ah == "" || !strings.HasPrefix(strings.ToLower(ah), "bearer ") {
			t.Errorf("gdrive %s: bad authorization header: %q", r.URL.Path, ah)
		} else if ah = ah[7:]; ah != "new-access" {
			t.Errorf("gdrive %s: authorization = %q; want new-access", r.URL.Path, ah)
		}

		if r.URL.Path == "/download" {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"starred_sessions": ["dummy-session-id"]}`))
			return
		}

		q := "'appfolder' in parents and title = 'user_data.json' and trashed = false"
		if v := r.FormValue("q"); v != q {
			t.Errorf("q = %q; want %q", v, q)
		}

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"items": [
      {
        "id": "not-this-one",
        "modifiedDate": "2015-04-10T12:12:46.034Z",
        "downloadUrl": "http://not-this-url"
      },
      {
        "id": "file-id",
        "modifiedDate": "2015-04-11T12:12:46.034Z",
        "downloadUrl": %q
      }
    ]}`, gdrive.URL+"/download")
	}))
	defer gdrive.Close()
	config.Google.Drive.FilesURL = gdrive.URL + "/"
	config.Google.Drive.Filename = "user_data.json"

	w := httptest.NewRecorder()
	r := newTestRequest(t, "GET", "/api/v1/user/schedule", nil)
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	cache.flush(c)
	serveUserSchedule(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	var list []string
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("json.Unmarshal: %v\nResponse: %s", err, w.Body.String())
	}
	if len(list) != 1 || list[0] != "dummy-session-id" {
		t.Errorf("list = %v; want ['dummy-session-id']\nResponse: %s", list, w.Body.String())
	}

	ad, err := appFolderDataFromCache(c, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if len(ad.Bookmarks) != 1 || ad.Bookmarks[0] != "dummy-session-id" {
		t.Errorf("ad.Bookmarks = %v; want ['dummy-session-id']", ad.Bookmarks)
	}

	cred, err := getCredentials(c, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if cred.AccessToken != "new-access" {
		t.Errorf("cred.AccessToken = %q; want 'new-access'", cred.AccessToken)
	}
	if cred.RefreshToken == "" {
		t.Errorf("cred.RefreshToken is empty")
	}
	if !cred.Expiry.After(time.Now()) {
		t.Errorf("cred is expired: %s", cred.Expiry)
	}
}

func TestHandleUserSchedulePut(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	checkAutHeader := func(who, ah string) {
		if ah == "" || !strings.HasPrefix(strings.ToLower(ah), "bearer ") {
			t.Errorf("%s: bad authorization header: %q", who, ah)
		} else if ah = ah[7:]; ah != "dummy-access" {
			t.Errorf("%s: authorization = %q; want dummy-access", who, ah)
		}
	}

	checkMetadata := func(r io.Reader) {
		var data struct {
			Title    string `json:"title"`
			MimeType string `json:"mimeType"`
			Parents  []struct {
				Id string `json:"id"`
			}
		}
		if err := json.NewDecoder(r).Decode(&data); err != nil {
			t.Errorf("checkMetadata: %v", err)
			return
		}
		if data.Title != "user_data.json" {
			t.Errorf("checkMetadata: data.Title = %q; want user_data.json", data.Title)
		}
		if data.MimeType != "application/json" {
			t.Errorf("checkMetadata: data.MimeType = %q; want application/json", data.MimeType)
		}
		if len(data.Parents) != 1 || data.Parents[0].Id != "appfolder" {
			t.Errorf(`checkMetadata: data.Parents = %+v; want [{"id":"appfolder"}]`, data.Parents)
		}
	}

	checkMedia := func(r io.Reader) {
		var data appFolderData
		if err := json.NewDecoder(r).Decode(&data); err != nil {
			t.Errorf("checkMedia: %v", err)
			return
		}
		if len(data.Bookmarks) != 1 || data.Bookmarks[0] != "new-session-id" {
			t.Errorf("checkMedia: data.Bookmarks = %v; want ['new-session-id']", data.Bookmarks)
		}
	}

	// drive search files server
	files := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		checkAutHeader("files", r.Header.Get("authorization"))
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"items":[]}`))
	}))
	defer files.Close()

	// drive upload server
	upload := make(chan struct{}, 1)
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		checkAutHeader("upload", r.Header.Get("authorization"))

		mediaType, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil {
			t.Fatalf("mime.ParseMediaType: %v", err)
		}
		if mediaType != "multipart/related" {
			t.Errorf("mediaType = %q; want multipart/related", mediaType)
		}

		mr := multipart.NewReader(r.Body, params["boundary"])
		count := 0
		for {
			p, err := mr.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				t.Fatalf("%d: mr.NextPart: %v", count, err)
			}
			if v := p.Header.Get("Content-Type"); !strings.HasPrefix(v, "application/json") {
				t.Errorf("%d: content-type = %q; want application/json", count, v)
			}
			switch count {
			case 0:
				checkMetadata(p)
			case 1:
				checkMedia(p)
			}
			count += 1
		}
		if count != 2 {
			t.Errorf("num. of parts = %d; want 2", count)
		}

		upload <- struct{}{}
	}))
	defer up.Close()

	config.Google.Drive.FilesURL = files.URL + "/"
	config.Google.Drive.UploadURL = up.URL + "/"
	config.Google.Drive.Filename = "user_data.json"

	c := newContext(newTestRequest(t, "GET", "/", nil))
	cred := &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "dummy-access",
	}
	if err := storeCredentials(c, cred); err != nil {
		t.Fatalf("storeCredentials: %v", err)
	}

	w := httptest.NewRecorder()
	r := newTestRequest(t, "PUT", "/api/v1/user/schedule/new-session-id", nil)
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	cache.flush(c)
	handleUserBookmarks(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	select {
	case <-upload:
		// passed
	default:
		t.Errorf("upload never happened")
	}

	var list []string
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("Unmarshal(response): %v", err)
	}
	if len(list) != 1 || list[0] != "new-session-id" {
		t.Errorf("list = %v; want ['new-session-id']", list)
	}

	ad, err := appFolderDataFromCache(c, cred.userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(ad.Bookmarks) != 1 || ad.Bookmarks[0] != "new-session-id" {
		t.Errorf("ad.Bookmarks = %v; want ['new-session-id']", ad.Bookmarks)
	}
}

func TestHandleUserScheduleDelete(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	// drive download file server
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"starred_sessions": ["one-session", "two-session"]}`))
	}))
	defer down.Close()

	// drive search files server
	files := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := "'appfolder' in parents and title = 'user_data.json' and trashed = false"
		if v := r.FormValue("q"); v != q {
			t.Errorf("q = %q; want %q", v, q)
		}

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"items": [{
      "id": "file-id",
      "modifiedDate": "2015-04-11T12:12:46.034Z",
      "downloadUrl": %q
    }]}`, down.URL)
	}))
	defer files.Close()

	// drive upload server
	upload := make(chan struct{}, 1)
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() { upload <- struct{}{} }()

		_, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil {
			t.Fatalf("mime.ParseMediaType: %v", err)
		}

		mr := multipart.NewReader(r.Body, params["boundary"])
		if _, err := mr.NextPart(); err != nil {
			t.Fatalf("0: mr.NextPart: %v", err)
		}

		p, err := mr.NextPart()
		if err != nil {
			t.Fatalf("1: mr.NextPart: %v", err)
		}
		var data appFolderData
		if err := json.NewDecoder(p).Decode(&data); err != nil {
			t.Fatalf("Decode(mr.NextPart): %v", err)
		}
		if len(data.Bookmarks) != 1 || data.Bookmarks[0] != "two-session" {
			t.Errorf("data.Bookmarks = %v; want ['two-session']", data.Bookmarks)
		}
	}))
	defer up.Close()

	config.Google.Drive.FilesURL = files.URL + "/"
	config.Google.Drive.UploadURL = up.URL + "/"
	config.Google.Drive.Filename = "user_data.json"

	c := newContext(newTestRequest(t, "GET", "/", nil))
	cred := &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "dummy-access",
	}
	if err := storeCredentials(c, cred); err != nil {
		t.Fatalf("storeCredentials: %v", err)
	}

	w := httptest.NewRecorder()
	r := newTestRequest(t, "DELETE", "/api/v1/user/schedule/one-session", nil)
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	cache.flush(c)
	handleUserBookmarks(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	select {
	case <-upload:
		// passed
	default:
		t.Errorf("upload never happened")
	}

	var list []string
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("Unmarshal(response): %v", err)
	}
	if len(list) != 1 || list[0] != "two-session" {
		t.Errorf("list = %v; want ['two-session']", list)
	}

	ad, err := appFolderDataFromCache(c, cred.userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(ad.Bookmarks) != 1 || ad.Bookmarks[0] != "two-session" {
		t.Errorf("ad.Bookmarks = %v; want ['two-session']", ad.Bookmarks)
	}
}

func TestGetUserDefaultPushConfig(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)

	w := httptest.NewRecorder()
	r := newTestRequest(t, "GET", "/api/v1/user/notify", nil)
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	handleUserNotifySettings(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if v, ok := body["notify"].(bool); !ok || v != false {
		t.Errorf("body.notify = %+v, ok = %v; want notify = false", body["notify"], ok)
	}
	if v := body["subscribers"]; v != nil {
		t.Errorf("body.subscribers = %+v; want nil", v)
	}
	if v := body["ioext"]; v != nil {
		t.Errorf("body.ioext = %+v; want nil", v)
	}
}

func TestStoreUserPushConfig(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)

	body := strings.NewReader(`{
    "notify": true,
    "subscriber": "sub-id",
    "endpoint": "https://test",
    "ioext": {
      "name": "Amsterdam",
      "lat": 52.37607,
      "lng": 4.886114
    }
  }`)
	expected := &userPush{
		userID:      testUserID,
		Enabled:     true,
		Subscribers: []string{"sub-id"},
		Endpoints:   []string{"https://test"},
		Ext: ioExtPush{
			Enabled: true,
			Name:    "Amsterdam",
			Lat:     52.37607,
			Lng:     4.886114,
		},
	}
	expected.Pext = &expected.Ext

	w := httptest.NewRecorder()
	r := newTestRequest(t, "PUT", "/api/v1/user/notify", body)
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	handleUserNotifySettings(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200\nResponse: %s", w.Code, w.Body.String())
	}

	var p1 userPush
	if err := json.Unmarshal(w.Body.Bytes(), &p1); err != nil {
		t.Errorf("json.Unmarshal: %v", err)
	}
	// these are not exposed in the API response
	p1.userID = expected.userID
	p1.Endpoints = expected.Endpoints
	if p1.Pext != nil {
		p1.Pext.Enabled = true
		p1.Ext = *p1.Pext
	}
	if !reflect.DeepEqual(&p1, expected) {
		t.Errorf("p1 = %+v; want %+v", p1, expected)
	}
	if !reflect.DeepEqual(p1.Pext, expected.Pext) {
		t.Errorf("p1.Pext = %+v; want %+v", p1.Pext, expected.Pext)
	}

	p2, err := getUserPushInfo(newContext(r), testUserID)
	if err != nil {
		t.Errorf("getUserPushInfo: %v", err)
	}
	if !reflect.DeepEqual(p2, expected) {
		t.Errorf("p2 = %+v; want %+v", p2, expected)
	}
	if !reflect.DeepEqual(p2.Pext, expected.Pext) {
		t.Errorf("p2.Pext = %+v; want %+v", p2.Pext, expected.Pext)
	}
}

func TestFirstSyncEventData(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	lastMod := time.Date(2015, 4, 15, 0, 0, 0, 0, time.UTC)
	startDate := time.Date(2015, 5, 28, 22, 0, 0, 0, time.UTC)

	const scheduleFile = `{
		"rooms":[
			{
				"id":"room-id",
				"name":"Community Lounge"
			}
		],
		"video_library":[
			{
				"thumbnailUrl":"http://img.youtube.com/test.jpg",
				"id":"video-id",
				"title":"Map Up your Apps!",
				"desc":"video desc",
				"year":2015,
				"topic":"Tools",
				"speakers":"Some Dude"
			}
		],
		"sessions":[
			{
				"id":"session-id",
				"url":"https://www.google.com",
				"title":"Introduction to Classroom",
				"description":"session desc",
				"startTimestamp":"2015-05-28T22:00:00Z",
				"endTimestamp":"2015-05-28T23:00:00Z",
				"isLivestream":true,
				"tags":["TYPE_BOXTALKS"],
				"speakers":["speaker-id"],
				"room":"room-id"
			}
		],
		"speakers":[
			{
				"id":"speaker-id",
				"name":"Google Devs",
				"bio":"speaker bio",
				"company":"Google",
				"plusoneUrl":"https://plus.google.com/user-id",
				"twitterUrl":"https://twitter.com/googledevs"
			}
		],
		"tags":[
			{
				"category":"TYPE",
				"tag":"TYPE_BOXTALKS",
				"name":"Boxtalks"
			}
		]
	}`

	video := &eventVideo{
		Thumb:    "http://img.youtube.com/test.jpg",
		Id:       "video-id",
		Title:    "Map Up your Apps!",
		Desc:     "video desc",
		Year:     2015,
		Topic:    "Tools",
		Speakers: "Some Dude",
	}
	session := &eventSession{
		Id:        "session-id",
		Title:     "Introduction to Classroom",
		Desc:      "session desc",
		IsLive:    true,
		Tags:      []string{"TYPE_BOXTALKS"},
		Speakers:  []string{"speaker-id"},
		Room:      "Community Lounge",
		StartTime: startDate,
		EndTime:   startDate.Add(1 * time.Hour),
		Day:       28,
		Block:     "3 PM",
		Start:     "3:00 PM",
		End:       "4:00 PM",
		Filters: map[string]bool{
			"Boxtalks":       true,
			liveStreamedText: true,
		},
	}
	speaker := &eventSpeaker{
		Id:      "speaker-id",
		Name:    "Google Devs",
		Bio:     "speaker bio",
		Company: "Google",
		Plusone: "https://plus.google.com/user-id",
		Twitter: "https://twitter.com/googledevs",
	}
	tag := &eventTag{
		Cat:  "TYPE",
		Tag:  "TYPE_BOXTALKS",
		Name: "Boxtalks",
	}

	done := make(chan struct{}, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/manifest.json" {
			w.Header().Set("last-modified", lastMod.Format(http.TimeFormat))
			w.Write([]byte(`{"data_files": ["schedule.json"]}`))
			return
		}
		if r.URL.Path != "/schedule.json" {
			t.Errorf("slurp path = %q; want /schedule.json", r.URL.Path)
		}
		w.Write([]byte(scheduleFile))
		done <- struct{}{}
	}))
	defer ts.Close()

	config.Schedule.ManifestURL = ts.URL + "/manifest.json"
	config.Schedule.Start = startDate

	r := newTestRequest(t, "POST", "/sync/gcs", nil)
	r.Header.Set("x-goog-channel-token", "sync-token")
	w := httptest.NewRecorder()
	syncEventData(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	select {
	case <-done:
		// passed
	default:
		t.Fatalf("slurp never happened")
	}

	data, err := getLatestEventData(newContext(r), nil)
	if err != nil {
		t.Fatalf("getLatestEventData: %v", err)
	}
	if data.modified.Unix() != lastMod.Unix() {
		t.Errorf("data.modified = %s; want %s", data.modified, lastMod)
	}
	if v := data.Videos["video-id"]; !reflect.DeepEqual(v, video) {
		t.Errorf("video = %+v\nwant %+v", v, video)
	}
	if v := data.Sessions["session-id"]; !reflect.DeepEqual(v, session) {
		t.Errorf("session = %+v\nwant %+v", v, session)
	}
	if v := data.Speakers["speaker-id"]; !reflect.DeepEqual(v, speaker) {
		t.Errorf("speaker = %+v\nwant %+v", v, speaker)
	}
	if v := data.Tags["TYPE_BOXTALKS"]; !reflect.DeepEqual(v, tag) {
		t.Errorf("tag = %+v\nwant %+v", v, tag)
	}
}

func TestSyncEventDataWithDiff(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	firstMod := time.Date(2015, 4, 15, 0, 0, 0, 0, time.UTC)
	lastMod := firstMod.AddDate(0, 0, 1)

	startDate := time.Date(2015, 5, 28, 22, 0, 0, 0, time.UTC)
	session := &eventSession{
		Id:        "test-session",
		Title:     "Introduction to Classroom",
		Desc:      "session desc",
		IsLive:    true,
		Tags:      []string{"TYPE_BOXTALKS"},
		Speakers:  []string{"speaker-id"},
		Room:      "Community Lounge",
		StartTime: startDate,
		EndTime:   startDate.Add(1 * time.Hour),
		Day:       1,
		Block:     "3 PM",
		Start:     "3:00 PM",
		End:       "4:00 PM",
		Filters: map[string]bool{
			"Boxtalks":       true,
			liveStreamedText: true,
		},
	}

	r := newTestRequest(t, "POST", "/sync/gcs", nil)
	r.Header.Set("x-goog-channel-token", "sync-token")
	c := newContext(r)

	err := storeEventData(c, &eventData{
		modified: firstMod,
		Sessions: map[string]*eventSession{session.Id: session},
	})
	if err != nil {
		t.Fatalf("storeEventData: %v", err)
	}
	err = storeChanges(c, &dataChanges{
		Updated: firstMod,
		eventData: eventData{
			Videos: map[string]*eventVideo{"dummy-id": &eventVideo{}},
		},
	})
	if err != nil {
		t.Fatalf("storeChanges: %v", err)
	}

	const newScheduleFile = `{
		"sessions":[
			{
				"id":"test-session",
				"url":"https://www.google.com",
				"title":"Introduction to Classroom",
				"description":"CHANGED DESCRIPTION",
				"startTimestamp":"2015-05-28T22:00:00Z",
				"endTimestamp":"2015-05-28T23:00:00Z",
				"isLivestream":true,
				"tags":["TYPE_BOXTALKS"],
				"speakers":["speaker-id"],
				"room":"room-id"
			}
		]
	}`

	done := make(chan struct{}, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/manifest.json" {
			sinceStr := r.Header.Get("if-modified-since")
			since, err := time.ParseInLocation(http.TimeFormat, sinceStr, time.UTC)
			if err != nil {
				t.Errorf("if-modified-since: time.Parse(%q): %v", sinceStr, err)
			}
			if since != firstMod {
				t.Errorf("if-modified-since (%q) = %s; want %s", sinceStr, since, firstMod)
			}
			w.Header().Set("last-modified", lastMod.Format(http.TimeFormat))
			w.Write([]byte(`{"data_files": ["schedule.json"]}`))
			return
		}
		w.Write([]byte(newScheduleFile))
		done <- struct{}{}
	}))
	defer ts.Close()

	config.Schedule.ManifestURL = ts.URL + "/manifest.json"
	config.Schedule.Start = startDate

	w := httptest.NewRecorder()
	syncEventData(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	select {
	case <-done:
		// passed
	default:
		t.Fatalf("slurp never happened")
	}

	data, err := getLatestEventData(c, nil)
	if err != nil {
		t.Fatalf("getLatestEventData: %v", err)
	}
	if data.modified.Unix() != lastMod.Unix() {
		t.Errorf("data.modified = %s; want %s", data.modified, lastMod)
	}

	s := data.Sessions[session.Id]
	if s == nil {
		t.Fatalf("%q session not found in %+v", session.Id, data.Sessions)
	}
	if v := "CHANGED DESCRIPTION"; s.Desc != v {
		t.Errorf("s.Desc = %q; want %q", s.Desc, v)
	}

	dc, err := getChangesSince(c, firstMod.Add(1*time.Second))
	if err != nil {
		t.Fatalf("getChangesAfter: %v", err)
	}
	if dc.Updated != lastMod {
		t.Errorf("dc.Changed = %s; want %s", dc.Updated, lastMod)
	}
	if l := len(dc.Videos); l != 0 {
		t.Errorf("len(dc.Videos) = %d; want 0", l)
	}
	s.Update = updateDetails
	if s2 := dc.Sessions[session.Id]; !reflect.DeepEqual(s2, s) {
		t.Errorf("s2 = %+v\nwant %+v", s2, s)
	}
}

func TestServeSWToken(t *testing.T) {
	defer resetTestState(t)

	r := newTestRequest(t, "GET", "/api/v1/user/updates", nil)
	r.Header.Set("authorization", "bearer "+testIDToken)
	w := httptest.NewRecorder()
	serveUserUpdates(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	var body struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal(%q): %v", w.Body.String(), err)
	}

	user, ts, err := decodeSWToken(body.Token)
	if err != nil {
		t.Fatalf("decodeSWToken(%q): %v", body.Token, err)
	}
	if user != testUserID {
		t.Errorf("user = %q; want %q", user, testUserID)
	}
	if now := time.Now(); now.Unix()-ts.Unix() > 3 {
		t.Errorf("ts = %s; want around %s", ts, now)
	}
}

func TestServeUserUpdates(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	// gdrive stub
	var gdrive *httptest.Server
	gdrive = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/list" {
			fmt.Fprintf(w, `{"items": [
        {
          "id": "file-id",
          "modifiedDate": "2015-04-11T12:12:46.034Z",
          "downloadUrl": %q
        }
      ]}`, gdrive.URL+"/download")
			return
		}
		w.Write([]byte(`{"starred_sessions": ["before", "after"]}`))
	}))
	defer gdrive.Close()

	config.Google.Drive.FilesURL = gdrive.URL + "/list"
	config.Google.Drive.Filename = "user_data.json"

	c := newContext(newTestRequest(t, "GET", "/dummy", nil))

	if err := storeCredentials(c, &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "access-token",
	}); err != nil {
		t.Fatal(err)
	}
	if err := storeUserPushInfo(c, &userPush{userID: testUserID}); err != nil {
		t.Fatal(err)
	}

	swToken := fetchFirstSWToken(t, testIDToken)
	_, swTime, err := decodeSWToken(swToken)
	if err != nil {
		t.Fatal(err)
	}
	timeBefore, timeAfter := swTime.AddDate(0, 0, -1), swTime.AddDate(0, 0, 1)
	swTokenBefore, _ := encodeSWToken(testUserID, timeBefore.Add(-1*time.Second))
	swTokenAfter, _ := encodeSWToken(testUserID, timeAfter)

	if err = storeChanges(c, &dataChanges{
		Updated: timeBefore,
		eventData: eventData{
			Sessions: map[string]*eventSession{
				"before": &eventSession{Update: updateDetails},
			},
		},
	}); err != nil {
		t.Fatal(err)
	}
	if err = storeChanges(c, &dataChanges{
		Updated: timeAfter,
		eventData: eventData{
			Sessions: map[string]*eventSession{
				"after":     &eventSession{Update: updateDetails},
				"unrelated": &eventSession{Update: updateDetails},
			},
		},
	}); err != nil {
		t.Fatal(err)
	}

	table := []struct {
		token    string
		sessions []string
		updated  time.Time
		next     time.Time
	}{
		{swToken, []string{"after"}, timeAfter, timeAfter.Add(1 * time.Second)},
		{swTokenBefore, []string{"before", "after"}, timeAfter, timeAfter.Add(1 * time.Second)},
		{swTokenAfter, []string{}, timeAfter, timeAfter.Add(1 * time.Second)},
	}

	for i, test := range table {
		r := newTestRequest(t, "GET", "/api/v1/user/updates", nil)
		r.Header.Set("authorization", test.token)
		w := httptest.NewRecorder()
		serveUserUpdates(w, r)

		if w.Code != http.StatusOK {
			t.Errorf("%d: w.Code = %d; want 200\nResponse: %s", i, w.Code, w.Body.String())
		}

		res := &dataChanges{}
		if err := json.Unmarshal(w.Body.Bytes(), res); err != nil {
			t.Errorf("%d: json.Unmarshal: %v", i, err)
			continue
		}
		if res.Updated.Unix() != test.updated.Unix() {
			t.Errorf("%d: res.Updated = %s; want %s", i, res.Updated, test.updated)
		}
		if len(res.Sessions) != len(test.sessions) {
			t.Errorf("%d: len(res.Sessions) = %d; want %d", i, len(res.Sessions), len(test.sessions))
		}
		for _, id := range test.sessions {
			s, ok := res.Sessions[id]
			if !ok {
				t.Errorf("%d: want session %q", i, id)
				break
			}
			if s.Update != updateDetails {
				t.Errorf("%d: res.Sessions[%q].Update = %q; want %q", i, id, s.Update, updateDetails)
			}
		}
		user, next, err := decodeSWToken(res.Token)
		if err != nil {
			t.Errorf("%d: decodeSWToken(%q): %v", i, res.Token, err)
		}
		if user != testUserID {
			t.Errorf("%d: user = %q; want %q", i, user, testUserID)
		}
		if next.Unix() != test.next.Unix() {
			t.Errorf("%d: next = %s; want %s", i, next, test.next)
		}
	}
}

func fetchFirstSWToken(t *testing.T, auth string) string {
	r := newTestRequest(t, "GET", "/api/v1/user/updates", nil)
	r.Header.Set("authorization", bearerHeader+testIDToken)
	w := httptest.NewRecorder()
	serveSWToken(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("w.Code = %d; want 200")
	}
	var sw struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &sw); err != nil {
		t.Fatal(err)
	}
	return sw.Token
}
