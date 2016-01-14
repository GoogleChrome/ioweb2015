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

  function initWorker() {
    var MAX_WORKER_TIMEOUT_ = 10 * 1000; // 10s
    var worker;

    var doMetrics = window.performance && window.performance.now;

    if (doMetrics) {
      var workerStartTime = window.performance.now();
      worker = new Worker('data-worker-scripts.js');
      var total = window.performance.now() - workerStartTime;

      if (window.ENV !== 'prod') {
        console.info('worker startup:', total, 'ms');
      }
      IOWA.Analytics.trackPerf('worker', 'creation', Math.ceil(total),
                               null, MAX_WORKER_TIMEOUT_);
    } else {
      worker = new Worker('data-worker-scripts.js');
    }

    worker.addEventListener('message', function(e) {
      if (!e.data) {
        return;
      }

      var template = IOWA.Elements.Template;

      var data = e.data;
      if (data.scheduleData) {
        // Report how long the worker fetch took to GA.
        if (doMetrics) {
          var total = window.performance.now() - workerFetchTime;
          if (window.ENV !== 'prod') {
            console.info('worker fetch:', total, 'ms');
          }
          IOWA.Analytics.trackPerf('worker', 'data fetch', Math.ceil(total),
                                   null, MAX_WORKER_TIMEOUT_);
        }

        IOWA.Schedule.resolveSchedulePromise(data);
      }
    });

    var workerFetchTime;
    if (doMetrics) {
      workerFetchTime = window.performance.now();
    }

    worker.postMessage({cmd: 'FETCH_SCHEDULE'});
  }

  function afterImports() {
    IOWA.Router = IOWA.Router_(window);
    IOWA.Elements.init();
    IOWA.Router.init(IOWA.Elements.Template);
    IOWA.Notifications.init();

    initWorker();
  }

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
      if (template.mapGalleryActive) {
        template.closeMapGallery();
      }
      var live = document.querySelector('io-live[open-widget]');
      if (live) {
        live.openWidget = false;
      }
    }
  });

  window.addEventListener('resize', function() {
    IOWA.Util.resizeRipple(IOWA.Elements.Ripple);
    IOWA.Elements.Drawer.closeDrawer();
  });

  window.addEventListener('offline', function(e) {
    IOWA.Elements.Toast.showMessage(
        'Offline. Changes you make to My Schedule will be saved for later.');
  });

  // Watch for sign-in changes to fetch user schedule, update UI, etc.
  window.addEventListener('signin-change', function(e) {
    var template = IOWA.Elements.Template;

    if (e.detail.signedIn) {
      // Check to see if there are any failed session modification requests, and
      // if so, replay them before fetching the user schedule.
      IOWA.Schedule.replayQueuedRequests().then(IOWA.Schedule.loadUserSchedule);

      // If the user hasn't denied notifications permission in the current browser,
      // and the user has notifications turned on globally (i.e. in at least one other browser),
      // and there isn't already a subscription in the current browser, then try to enable
      // notifications in the current browser.
      if (window.Notification.permission !== 'denied') {
        IOWA.Notifications.isNotifyEnabledPromise().then(function(isGlobalNotificationsEnabled) {
          if (isGlobalNotificationsEnabled) {
            IOWA.Notifications.isExistingSubscriptionPromise().then(function(isLocalSubscription) {
              if (!isLocalSubscription) {
                IOWA.Notifications.subscribePromise();
              }
            });
          }
        });
      }

    } else {
      IOWA.Schedule.clearUserSchedule();
    }
  });

  if (IOWA.Util.supportsHTMLImports) {
    afterImports();
  } else {
    document.addEventListener('WebComponentsReady', afterImports);
  }
})();
