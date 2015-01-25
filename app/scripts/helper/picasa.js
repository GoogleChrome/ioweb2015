/**
 * Copyright 2014 Google Inc. All rights reserved.
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

  var GDEVELOPER_USER_ID = '111395306401981598462';
  var ALBUM_ID = '6029456067262589905';
  var lang = document.documentElement.lang;

  var feedUrl = 'https://picasaweb.google.com/data/feed/api/user/' +
                GDEVELOPER_USER_ID + '/albumid/' + ALBUM_ID +
                '?alt=jsonc&kind=photo&hl=' + lang + '&imgmax=1152&max-results=5000' +
                '&v=2';

  function fetch(url, opt_startIndex) {
    var startIndex = opt_startIndex || 1;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url + '&start-index=' + startIndex);
    xhr.onload = function(e) {
      if (this.status != 200) {
        return;
      }
      var photos = JSON.parse(this.response).data.items;
      for (var i = 0; i < photos.length; ++i) {
        var photo = photos[i];
        console.log(photo.media.image.url);
      }
    };

    xhr.send();
  }

  return {
    fetch: fetch
  };

})();
