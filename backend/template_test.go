package main

import (
	"bytes"
	"html/template"
	"testing"
)

func init() {
	rootDir = "app"
}

func TestRenderIndex(t *testing.T) {
	var b bytes.Buffer
	if err := renderTemplate(&b, "index"); err != nil {
		t.Fatalf("render(index): %v", err)
	}
}

func TestPageTitle(t *testing.T) {
	table := []struct{ template, out string }{
		{``, defaultTitle},
		{`{{define "title"}}my-title{{end}}`, "my-title - " + defaultTitle},
	}
	for i, test := range table {
		tmpl, err := template.New("").Parse(test.template)
		if err != nil {
			t.Errorf("%d: template.Parse(%q): %v", i, test.template, err)
			continue
		}
		title := pageTitle(tmpl)
		if title != test.out {
			t.Errorf("%d: pageTitle(%q) = %q; want %q", i, test.template, title, test.out)
		}
	}
}
