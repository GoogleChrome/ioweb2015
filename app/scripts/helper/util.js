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

IOWA.Util = IOWA.Util || (function() {

  "use strict";

  /**
   * Create a deferred object, allowing a Promise to be fulfilled at a later
   * time.
   * @return {{promise: !Promise, resolve: function(), reject: function()}}
   */
  function createDeferred() {
    var resolveFn;
    var rejectFn;
    var promise = new Promise(function(resolve, reject) {
      resolveFn = resolve;
      rejectFn = reject;
    });
    return {
      promise: promise,
      resolve: resolveFn,
      reject: rejectFn
    };
  }

  // From http://en.wikipedia.org/wiki/Smoothstep
  function smoothStep(start, end, point) {
    if (point <= start) {
      return 0;
    }
    if (point >= end) {
      return 1;
    }
    var x = (point - start) / (end - start); // interpolation
    return x * x * (3 - 2 * x);
  }

  /**
   * Smooth scrolls to the top of an element.
   *
   * @param {Element} el Element to scroll to.
   * @param {number=} opt_duration Optional duration for the animation to
   *     take. If not specified, the element is immediately scrolled to.
   * @param {function()=} opt_callback Callback to execute at the end of the scroll.
   */
  function smoothScroll(el, opt_duration, opt_callback) {
    var duration = opt_duration || 1;

    var scrollContainer = IOWA.Elements.ScrollContainer;

    var startTime = performance.now();
    var endTime = startTime + duration;
    var startTop = scrollContainer.scrollTop;
    var destY = el.getBoundingClientRect().top;

    if (destY === 0) {
      if (opt_callback) {
        opt_callback();
      }
      return; // already at top of element.
    }

    var callback = function(timestamp) {
      if (timestamp < endTime) {
        requestAnimationFrame(callback);
      }

      var point = smoothStep(startTime, endTime, timestamp);
      var scrollTop = Math.round(startTop + (destY * point));

      scrollContainer.scrollTop = scrollTop;

      // All done scrolling.
      if (point === 1 && opt_callback) {
        opt_callback();
      }
    };

    callback(startTime);
  }

  function isIOS() {
    return (/(iPhone|iPad|iPod)/gi).test(navigator.platform);
  }

  function isSafari() {
    var userAgent = navigator.userAgent;
    return (/Safari/gi).test(userAgent) &&
      !(/Chrome/gi).test(userAgent);
  }

  function isIE() {
    var userAgent = navigator.userAgent;
    return (/Trident/gi).test(userAgent);
  }

  function isFF() {
    var userAgent = navigator.userAgent;
    return (/Firefox/gi).test(userAgent);
  }

  function isTouchScreen() {
    return ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;
  }

  /**
   * Sets the <meta name="theme-color"> to the specified value.
   * @param {string} color Color hex value.
   */
  function setMetaThemeColor(color) {
    var metaTheme = document.documentElement.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.content = color;
    }
  }

  /**
   * Returns the static base URL of the running app.
   * https://events.google.com/io2015/about -> https://events.google.com/io2015/
   */
  function getStaticBaseURL() {
    var url = location.href.replace(location.hash, '');
    return url.substring(0, url.lastIndexOf('/') + 1);
  }

  /**
   * Gets a param from the search part of a URL by name.
   * @param {string} param URL parameter to look for.
   * @return {string|undefined} undefined if the URL parameter does not exist.
   */
  function getURLParameter(param) {
    if (!window.location.search) {
      return;
    }
    var m = new RegExp(param + '=([^&]*)').exec(window.location.search.substring(1));
    if (!m) {
      return;
    }
    return decodeURIComponent(m[1]);
  }

  /**
   * Removes a param from the search part of a URL.
   * @param {string} search Search part of a URL, e.g. location.search.
   * @param {string} name Param name.
   * @return {string} Modified search.
   */
  function removeSearchParam(search, name) {
    if (search[0] === '?') {
      search = search.substring(1);
    }
    var parts = search.split('&');
    var res = [];
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i].split('=');
      if (pair[0] === name) {
        continue;
      }
      res.push(parts[i]);
    }
    search = res.join('&');
    if (search.length > 0) {
      search = '?' + search;
    }
    return search;
  }

  /**
   * Adds a new or replaces existing param of the search part of a URL.
   * @param {string} search Search part of a URL, e.g. location.search.
   * @param {string} name Param name.
   * @param {string} value Param value.
   * @return {string} Modified search.
   */
  function setSearchParam(search, name, value) {
    search = removeSearchParam(search, name);
    if (search === '') {
      search = '?';
    }
    if (search.length > 1) {
      search += '&';
    }
    return search + name + '=' + encodeURIComponent(value);
  }

  /**
   * Use Google's URL shortener to compress an URL for social.
   * @param {string} url - The full url.
   * @return {Promise}
   */
  function shortenURL(url) {
    var SHORTENER_API_URL = 'https://www.googleapis.com/urlshortener/v1/url';
    // TODO: add key to config.
    var SHORTENER_API_KEY = 'AIzaSyBRMm_PwR1cfjT_yLxBiV9PDrwZPRIRLxg';

    var endpoint = SHORTENER_API_URL + '?key=' + SHORTENER_API_KEY;

    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();

      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');

      xhr.onloadend = function(e) {
        if (this.status === 200) {
          try {
            var data = JSON.parse(this.response);
            resolve(data.id);
          } catch (e) {
            reject('Parsing URL Shortener result failed.');
          }
        } else {
          resolve(url); // resolve with original URL.
        }
      };

      xhr.send(JSON.stringify({longUrl: url}));
    });
  }

  /**
   * Adjusts the size of the ripple to fully cover the parent element.
   * @param {Element} ripple The ripple DOM element.
   * @return {Object} parentRect Parent bounding rect, for reuse.
   */
  var resizeRipple = function(ripple) {
    var parentRect = ripple.parentNode.getBoundingClientRect();

    var rippleContainerSize = parentRect.width / 2;
    ripple.style.width = rippleContainerSize + 'px';
    ripple.style.height = rippleContainerSize + 'px';
    ripple.style.left = -(rippleContainerSize / 2) + 'px';
    ripple.style.top = -(rippleContainerSize / 2) + 'px';

    return parentRect;
  };

  /**
   * Reports an error to Google Analytics.
   * Normally, this is done in the window.onerror handler, but this helper method can be used in the
   * catch() of a promise to log rejections.
   * @param {Error|string} error The error to report.
   */
  var reportError = function(error) {
    // Google Analytics has a max size of 500 bytes for the event location field.
    // If we have an error with a stack trace, the trailing 500 bytes are likely to be the most
    // relevant, so grab those.
    var location = (error && typeof error.stack === 'string') ?
      error.stack.slice(-500) : 'Unknown Location';
    IOWA.Analytics.trackError(location, error);
  };

  /**
   * Returns the target element that was clicked/tapped.
   * @param {Event} e The click/tap event.
   * @param {string} tagName The element tagName to stop at.
   */
  var getEventSender = function(e, tagName) {
    var path = Polymer.dom(e).path;

    var target = null;
    for (var i = 0; i < path.length; ++i) {
      var el = path[i];
      if (el.localName === tagName) {
        target = el;
        break;
      }
    }

    return target;
  };

  return {
    createDeferred: createDeferred,
    isFF: isFF,
    isIE: isIE,
    isIOS: isIOS,
    isSafari: isSafari,
    isTouchScreen: isTouchScreen,
    setMetaThemeColor: setMetaThemeColor,
    supportsHTMLImports: 'import' in document.createElement('link'),
    smoothScroll: smoothScroll,
    shortenURL: shortenURL,
    getURLParameter: getURLParameter,
    getStaticBaseURL: getStaticBaseURL,
    setSearchParam: setSearchParam,
    getEventSender: getEventSender,
    removeSearchParam: removeSearchParam,
    resizeRipple: resizeRipple,
    reportError: reportError
  };

})();
