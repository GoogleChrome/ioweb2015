package main

import "net/http"

// serveTemplate responds with text/html content of the executed template
// found under request path.
// 'index' template is assumed if request path ends with '/'.
func serveTemplate(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Path
	if name[len(name)-1] == '/' {
		name += "index"
	}
	w.Header().Set("Content-Type", "text/html;charset=utf-8")
	err := renderTemplate(w, name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
