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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js', {
      scope: './'
    }).then(function(registration) {
      registration.onupdatefound = function() {
        // The updatefound event implies that registration.installing is set; see
        // https://slightlyoff.github.io/ServiceWorker/spec/service_worker/index.html#service-worker-container-updatefound-event
        var installingWorker = registration.installing;
        installingWorker.onstatechange = function() {
          // TODO: How do we handle i18n of these strings?
          switch (installingWorker.state) {
            case 'installed':
              if (navigator.serviceWorker.controller) {
                // Define a handler that will be used for the next io-toast tap, at which point it
                // be automatically removed.
                var tapHandler = function() {
                  window.location.reload();
                };

                IOWA.Elements.Toast.showMessage('Tap here or refresh the page for the latest content.',
                  tapHandler);
              } else {
                IOWA.Elements.Toast.showMessage('Caching complete. This site is ready to work offline!');
              }
              break;

            case 'redundant':
              throw 'The installing service worker became redundant.';
          }
        };
      };
    }).catch(function(e) {
      IOWA.Analytics.trackError('navigator.serviceWorker.register() error', e);
      console.error('Service worker registration failed:', e);
    });
  }

  function afterImports() {
    IOWA.Elements.init();
    IOWA.Router.init();
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
      if (IOWA.Elements.Template.fullscreenVideoActive) {
        if (template.closeVideoCard) {
          template.closeVideoCard();
        }
        if (template.closeVideoSection) {
          template.closeVideoSection();
        }
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
})();
