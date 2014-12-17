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

if ('serviceWorker' in navigator) {

  // TODO: change scope accordingly to the production address.
  navigator.serviceWorker.register('/sw.js', {
    scope: '/'
  }).then(function(registration) {

    var newServiceWorkerAvailableMessage =
        'A new version of this page is available. Please force-refresh.';

    // If this fires we should check if there's a new Service Worker
    // waiting to be activated. If so, ask the user to force refresh.
    if (registration.waiting) {
      IOWA.Elements.Toast.showMessage(newServiceWorkerAvailableMessage);
      return;
    }

    // We should also start tracking for any updates to the Service Worker.
    registration.onupdatefound = function(event) {

      IOWA.Elements.Toast.showMessage(
          'A new version has been found... Installing...');

      // If an update is found the spec says that there is a new Service Worker
      // installing, so we should wait for that to complete then show a
      // notification to the user.
      registration.installing.onstatechange = function(event) {
        if (this.state === 'installed')
          IOWA.Elements.Toast.showMessage(newServiceWorkerAvailableMessage);
        else
          console.log("New Service Worker state: ", this.state);
      };
    };
  }, function(err) {
    console.log(err);
  });
}
