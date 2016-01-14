/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

window.IOWA = window.IOWA || {};

IOWA.Picasa = (function() {

  "use strict";

  var API_ENDPOINT = 'api/v1/photoproxy';
  var GDEVELOPER_USER_ID = '111395306401981598462';
  var IO_ALBUM_ID = '6148448302499535601';
  var EXTENDED_ALBUM_ID = '6151106494033928993';

  var lang = document.documentElement.lang;
  var viewPortWidth = document.documentElement.clientWidth;

  function getFeedUrl(albumId) {
    return 'https://picasaweb.google.com/data/feed/api/user/' +
           GDEVELOPER_USER_ID + '/albumid/' + albumId +
           '?alt=jsonc&kind=photo&hl=' + lang +
           '&imgmax=' + Math.min(parseInt(viewPortWidth * (window.devicePixelRatio || 1)), 1440) +
           '&max-results=5000&v=2';
  }

  function fetchPhotos(opt_startIndex, callback, opt_albumId) {
    var startIndex = opt_startIndex || 1;
    var feedUrl = getFeedUrl(opt_albumId || IO_ALBUM_ID);

    var url = API_ENDPOINT + '?url=' +
              encodeURIComponent(feedUrl + '&start-index=' + startIndex);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = function(e) {
      if (this.status != 200) {
        return;
      }
      var photos = JSON.parse(this.response).data.items;
      callback(photos);
    };

    xhr.send();
  }

  function fetchExtendedPhotos(callback) {
    return fetchPhotos(null, callback, EXTENDED_ALBUM_ID);
  }

  return {
    fetchPhotos: fetchPhotos,
    fetchExtendedPhotos: fetchExtendedPhotos
  };

})();
