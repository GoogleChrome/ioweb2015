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

IOWA.ServiceWorkerRegistration = (function() {
  "use strict";

  // Ensure we only attempt to register the SW once.
  var isAlreadyRegistered = false;

  var register = function() {
    if (!isAlreadyRegistered) {
      isAlreadyRegistered = true;

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js', {
          scope: './'
        }).then(function(registration) {
          // Check to see if there's an updated version of service-worker.js with new files to cache:
          // https://slightlyoff.github.io/ServiceWorker/spec/service_worker/index.html#service-worker-registration-update-method
          // Note: registration.update() is not yet widely implemented.
          if (typeof registration.update == 'function') {
            registration.update();
          }

          registration.onupdatefound = function() {
            // The updatefound event implies that registration.installing is set; see
            // https://slightlyoff.github.io/ServiceWorker/spec/service_worker/index.html#service-worker-container-updatefound-event
            var installingWorker = registration.installing;
            installingWorker.onstatechange = function() {
              // TODO: How do we handle i18n of these strings?
              switch (installingWorker.state) {
                case 'installed':
                  if (!navigator.serviceWorker.controller) {
                    IOWA.Elements.Toast.showMessage(
                        'Caching complete! Future visits will work offline.');
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
    }
  };

  // Check to see if the service worker controlling the page at initial load
  // has become redundant, since this implies there's a new service worker with fresh content.
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.onstatechange = function(event) {
      if (event.target.state === 'redundant') {
        // Define a handler that will be used for the next io-toast tap, at which point it
        // be automatically removed.
        var tapHandler = function() {
          window.location.reload();
        };

        IOWA.Elements.Toast.showMessage(
            'Tap here or refresh the page for the latest content.', tapHandler);
      }
    };
  }

  return {
    register: register
  };
})();
