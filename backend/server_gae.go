// This file is used only when compiled with GAE support.
// GAE-based backend serves only templates.

// +build appengine

package main

import (
	"bufio"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/net/context"

	"appengine"
	"appengine/user"
)

var (
	// rootDir is relative to basedir of app.yaml is (app root)
	rootDir = "app"
	// httpPrefix is the URL path prefix to serve the app from
	httpPrefix = "/io2015"
	// whitemap contains whitelisted email addresses or domains.
	// whitelisted domains should be prefixed with "@", e.g. @example.org
	whitemap map[string]bool
)

func init() {
	cache = &gaeMemcache{}
	initWhitelist()

	wrapHandler = checkWhitelist
	handle("/", serveTemplate)
	handle("/api/extended", serveIOExtEntries)
	// setup root redirect if we're prefixed
	if httpPrefix != "/" {
		http.Handle("/", http.RedirectHandler(httpPrefix, http.StatusFound))
	}
}

// initWhitelist initializes and populates whitemap from whitelist file.
func initWhitelist() {
	whitemap = make(map[string]bool)
	f, err := os.Open(filepath.Join(rootDir, "..", "whitelist"))
	if err != nil {
		panic(err)
	}
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		whitemap[scanner.Text()] = true
	}
	if err := scanner.Err(); err != nil {
		panic(err)
	}
}

// isWhitelisted returns a value of the whitemap for the key
// of either email or its domain.
func isWhitelisted(email string) bool {
	if v, ok := whitemap[email]; ok {
		return v
	}
	i := strings.Index(email, "@")
	return whitemap[email[i:]]
}

// checkWhitelist checks whether the current user is allowed to access
// handler h using isWhitelisted() func before handing over in-flight request.
// It redirects to GAE login URL if no user found or responds with 403
// (Forbidden) HTTP error code if the current user is not whitelisted.
func checkWhitelist(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ac := appengine.NewContext(r)
		u := user.Current(ac)
		if u == nil {
			url, err := user.LoginURL(ac, r.URL.Path)
			if err != nil {
				ac.Errorf("user.LoginURL(%q): %v", r.URL.Path, err)
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			http.Redirect(w, r, url, http.StatusFound)
			return
		}
		if !isWhitelisted(u.Email) {
			ac.Errorf("%s is not whitelisted", u.Email)
			http.Error(w, "Access denied, sorry. Try with a different account.", http.StatusForbidden)
			return
		}
		h.ServeHTTP(w, r)
	})
}

// newContext returns a newly created context of the in-flight request r.
func newContext(r *http.Request) context.Context {
	ac := appengine.NewContext(r)
	v := appengine.VersionID(ac)
	if i := strings.Index(v, "."); i > 0 {
		v = v[:i]
	}
	var appEnv string
	switch {
	default:
		appEnv = "dev"
	case strings.HasSuffix(v, "-prod"):
		appEnv = "prod"
	case strings.HasSuffix(v, "-stage"):
		appEnv = "stage"
	}
	c := context.WithValue(context.Background(), ctxKeyEnv, appEnv)
	return context.WithValue(c, ctxKeyGAEContext, ac)
}

// appengineContext extracts appengine.Context value from the context c
// associated with an in-flight request.
func appengineContext(c context.Context) appengine.Context {
	ac, ok := c.Value(ctxKeyGAEContext).(appengine.Context)
	if !ok || ac == nil {
		panic("never reached: no appengine.Context found")
	}
	return ac
}
