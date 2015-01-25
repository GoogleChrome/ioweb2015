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

IOWA.Util = IOWA.Util || (function() {

  "use strict";

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
   */
  function smoothScroll(el, opt_duration) {
    var duration = opt_duration || 1;

    var scrollContainer = IOWA.Elements.ScrollContainer;

    var startTime = performance.now();
    var endTime = startTime + duration;
    var startTop = scrollContainer.scrollTop;
    var destY = el.getBoundingClientRect().top;

    if (destY === 0) {
      return; // already at top of element.
    }

    var callback = function(timestamp) {
      if (timestamp < endTime) {
        requestAnimationFrame(callback);
      }

      var point = smoothStep(startTime, endTime, timestamp);
      var scrollTop = Math.round(startTop + (destY * point));

      scrollContainer.scrollTop = scrollTop;
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

  /**
   * Returns the static base URL of the running app.
   * https://events.google.com/io2015/about -> https://events.google.com/io2015/
   */
  function getStaticBaseURL() {
    return location.href.substring(0, location.href.lastIndexOf('/') + 1);
  }

  /**
   * Adjusts the size of the ripple to fully cover the parent element.
   * @param {Element} ripple The ripple DOM element.
   * @return {Object} parentRect Parent bounding rect, for reuse.
   */
  var resizeRipple = function(ripple) {
    var parentRect = ripple.parentNode.getBoundingClientRect();
    var radius = Math.floor(Math.sqrt(parentRect.width * parentRect.width +
      parentRect.height * parentRect.height));
    ripple.style.width = 2 * radius + 'px';
    ripple.style.height = 2 * radius + 'px';
    ripple.style.left = -radius + 'px';
    ripple.style.top = -radius + 'px';
    return parentRect;
  };

  return {
    isIE: isIE,
    isIOS: isIOS,
    isSafari: isSafari,
    smoothScroll: smoothScroll,
    getStaticBaseURL: getStaticBaseURL,
    resizeRipple: resizeRipple
  };

})();
