// This file is used only when compiled without GAE support.
// The standalone backend serves both static assets and templates.

// +build !appengine

package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"

	"golang.org/x/net/context"
)

var (
	rootDir    = "app"
	listenAddr = "127.0.0.1:8080"
	// URL path prefix to serve from
	httpPrefix = "/io2015"
	// app environment: "dev", "stage" or "prod"
	// don't refer to this directly, use env(c) func instead.
	appEnv string
)

// init runs before main.
func init() {
	appEnv = os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "dev"
	}
	flag.StringVar(&rootDir, "d", rootDir, "app root dir")
	flag.StringVar(&listenAddr, "listen", listenAddr, "address to listen on")
	flag.StringVar(&httpPrefix, "prefix", httpPrefix, "URL path prefix to serve from")
	flag.StringVar(&appEnv, "env", appEnv, "app environment: dev, stage or prod")

	wrapHandler = logHandler
}

// main is the entry point of the standalone server.
func main() {
	flag.Parse()
	if httpPrefix == "" || httpPrefix[0] != '/' {
		httpPrefix = "/" + httpPrefix
	}

	cache = newMemoryCache()
	handle("/", catchAllHandler)
	handle("/api/extended", serveIOExtEntries)
	// setup root redirect if we're prefixed
	if httpPrefix != "/" {
		http.Handle("/", http.RedirectHandler(httpPrefix, http.StatusFound))
	}

	log.Fatal(http.ListenAndServe(listenAddr, nil))
}

// newContext returns a newly created context of the in-flight request r.
func newContext(r *http.Request) context.Context {
	return context.WithValue(context.Background(), ctxKeyEnv, appEnv)
}

// catchAllHandler serves either static content from rootDir
// or responds with a rendered template if no static asset found
// under the in-flight request.
func catchAllHandler(w http.ResponseWriter, r *http.Request) {
	p := path.Clean("/" + r.URL.Path)
	if p == "/" {
		p += "index"
	}
	p = filepath.Join(rootDir, filepath.FromSlash(p))

	if _, err := os.Stat(p); os.IsNotExist(err) {
		serveTemplate(w, r)
		return
	}

	http.ServeFile(w, r, p)
}

// logHandler logs each request before handing it over to the handler h.
func logHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		h.ServeHTTP(w, r)
	})
}
