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

(function() {
  // Polyfill Promise() in browsers that don't support it natively.
  ES6Promise.polyfill();

  function afterImports() {
    IOWA.Elements.init();
    IOWA.Router.init();

    CoreStyle.g.paperInput.labelColor = '#009688';
    CoreStyle.g.paperInput.focusedColor = '#009688';
  }

  window.addEventListener('core-media-change', function(e) {
    // Disable swipping on tablet/desktop.
    if (e.target.id === 'mq-phone') {
      var isPhoneSize = e.detail.matches;
      IOWA.Elements.Drawer.querySelector('[drawer]').hidden = !isPhoneSize;
      IOWA.Elements.Drawer.disableSwipe = !isPhoneSize;
    }
  });

  window.addEventListener('keydown', function(e) {
    // ESC closes any overlays.
    if (e.keyCode === 27) {
      var template = IOWA.Elements.Template;
      if (template.photoGalleryActive) {
        template.togglePhotoGallery();
      }
      if (template.fullscreenVideoActive) {
        if (template.closeVideoCard) {
          template.closeVideoCard();
        }
        if (template.closeVideoSection) {
          template.closeVideoSection();
        }
      }
      if (template.extendedMapActive) {
        template.closeExtendedMapSection();
      }
    }
  });

  window.addEventListener('resize', function() {
    IOWA.Util.resizeRipple(IOWA.Elements.Ripple);
    IOWA.Elements.Drawer.closeDrawer();
  });

  if (IOWA.Util.supportsHTMLImports) {
    afterImports();
  } else {
    document.addEventListener('polymer-ready', afterImports);
  }

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // Disconnect from Firebase's WebSocket when the current tab isn't visible.
      Firebase.goOffline();
    } else {
      Firebase.goOnline();
    }
  });
})();
