package main

import (
	"bytes"
	"html/template"
	"io"
	"path/filepath"
)

// defaultTitle is the site pages default title
const defaultTitle = "Google I/O 2015"

// tmplFunc is a map of functions available to all templates.
var tmplFunc = template.FuncMap{
	"safeHTML": func(v string) template.HTML { return template.HTML(v) },
}

// renderTemplate executes a template found in 'name' file
// using layout.html as the root template.
// If name does not end with an extension, '.html' is appended.
func renderTemplate(w io.Writer, name string) error {
	if filepath.Ext(name) == "" {
		name += ".html"
	}

	t, err := template.New("layout.html").Delims("{%", "%}").Funcs(tmplFunc).ParseFiles(
		filepath.Join(rootDir, "templates", "layout.html"),
		filepath.Join(rootDir, "templates", name),
	)
	if err != nil {
		return err
	}

	data := struct{ Title string }{
		Title: pageTitle(t),
	}
	return t.Execute(w, data)
}

// pageTitle executes "title" template of the given template set and returns the result,
// appending defaultTitle separated by a ' - '.
// In the absence of the template or execution error, defaultTitle is returned.
func pageTitle(t *template.Template) string {
	tb := new(bytes.Buffer)
	if err := t.ExecuteTemplate(tb, "title", nil); err != nil {
		return defaultTitle
	}

	title := tb.String()
	if title != "" {
		title += " - " + defaultTitle
	}
	return title
}
