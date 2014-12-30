// This file is used only when compiled without GAE support.
// The standalone backend serves both static assets and templates.

// +build !appengine

package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
)

var rootDir string

// main is the entry point of the standalone server.
func main() {
	flag.StringVar(&rootDir, "d", "app", "app root dir")
	flag.Parse()

	http.HandleFunc("/", catchAllHandler)

	log.Fatal(http.ListenAndServe("127.0.0.1:8080", nil))
}

// catchAllHandler serves either static content from rootDir
// or responds with a rendered template if no static asset found
// under the in-flight request.
func catchAllHandler(w http.ResponseWriter, r *http.Request) {
	logmsg := fmt.Sprintf("%s %s", r.Method, r.URL.Path)
	defer func() {
		log.Println(logmsg)
	}()

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
