// Copyright 2015 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"bytes"
	"encoding/gob"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	jwt "github.com/dgrijalva/jwt-go"
	"golang.org/x/net/context"
)

// verifyIDToken verifies Google ID token, which heavily based on JWT.
// It returns user ID of the pricipal who granted an authorization.
func verifyIDToken(c context.Context, t string) (string, error) {
	token, err := jwt.Parse(t, func(j *jwt.Token) (interface{}, error) {
		kid, _ := j.Header["kid"].(string)
		keys, err := idTokenCerts(c)
		if err != nil {
			return nil, err
		}
		cert, ok := keys[kid]
		if !ok {
			return nil, fmt.Errorf("verifyIDToken: keys[%q] = nil", kid)
		}
		return cert, nil
	})

	if err != nil {
		return "", err
	}
  sub, ok := token.Claims.(jwt.MapClaims)["sub"].(string)
	if !ok {
		return "", errors.New("verifyIDToken: invalid 'sub' claim")
	}
	return sub, nil
}

// idTokenCerts returns public certificates used to encrypt ID tokens.
// It returns a cached copy, if available, or fetches from a known URL otherwise.
// The returnd map is keyed after the cert IDs.
func idTokenCerts(c context.Context) (map[string][]byte, error) {
	certURL := config.Google.CertURL
	// try cache first
	keys, err := certsFromCache(c, certURL)
	if err == nil {
		return keys, nil
	}
	// fetch from public endpoint otherwise
	var exp time.Duration
	keys, exp, err = fetchPublicKeys(c, certURL)
	if err != nil {
		return nil, err
	}
	if exp <= 0 {
		return keys, nil
	}
	// cache the result for duration exp
	var data bytes.Buffer
	if err := gob.NewEncoder(&data).Encode(keys); err != nil {
		errorf(c, "idTokenCerts: %v", err)
	} else if err := cache.set(c, certURL, data.Bytes(), exp); err != nil {
		errorf(c, "idTokenCerts: cache.set(%q): %v", certURL, err)
	}
	// return the result anyway, even on cache errors
	return keys, nil
}

// certsFromCache returns cached public keys.
// See idTokenCerts func.
func certsFromCache(c context.Context, k string) (map[string][]byte, error) {
	data, err := cache.get(c, k)
	if err != nil {
		return nil, err
	}
	var keys map[string][]byte
	return keys, gob.NewDecoder(bytes.NewReader(data)).Decode(&keys)
}

// certsFromCache fetches public keys from the network.
// See idTokenCerts func.
func fetchPublicKeys(c context.Context, url string) (map[string][]byte, time.Duration, error) {
	res, err := httpClient(c).Get(url)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("fetchPublicKeys: %s: %v", url, res.Status)
	}
	var body map[string]string
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, 0, err
	}
	keys := make(map[string][]byte)
	for k, v := range body {
		keys[k] = []byte(v)
	}
	return keys, resourceExpiry(res.Header), nil
}

// resourceExpiry returns the remaining life of a resource
// based on Cache-Control and Age headers.
func resourceExpiry(h http.Header) time.Duration {
	var max int64
	for _, c := range strings.Split(h.Get("cache-control"), ",") {
		c = strings.ToLower(strings.TrimSpace(c))
		if !strings.HasPrefix(c, "max-age=") {
			continue
		}
		var err error
		if max, err = strconv.ParseInt(c[8:], 10, 64); err != nil {
			max = 0
		}
		break
	}
	age, err := strconv.ParseInt(h.Get("age"), 10, 64)
	if err != nil {
		age = 0
	}
	r := max - age
	if r < 0 {
		return 0
	}
	return time.Duration(r) * time.Second
}
