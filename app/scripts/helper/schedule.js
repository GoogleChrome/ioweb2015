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

self.IOWA = self.IOWA || {};

IOWA.Schedule = (function() {

  "use strict";

  var SCHEDULE_ENDPOINT = 'api/v1/schedule';
  var SCHEDULE_ENDPOINT_USERS = 'api/v1/user/schedule';
  var SURVEY_ENDPOINT_USERS = 'api/v1/user/survey';
  var QUEUED_SESSION_UPDATES_DB_NAME = 'shed-offline-session-updates';

  var scheduleData_ = null;
  var cache = {
    'userSavedSessions': [],
    'userSavedSurveys': []
  };

  // A promise fulfilled by the loaded schedule.
  var scheduleDeferredPromise = null;

  // The resolve function for scheduleDeferredPromise;
  var scheduleDeferredPromiseResolver = null;

  /**
   * Create the deferred schedule-fetching promise `scheduleDeferredPromise`.
   * @private
   */
  function createScheduleDeferred_() {
    var scheduleDeferred = IOWA.Util.createDeferred();
    scheduleDeferredPromiseResolver = scheduleDeferred.resolve;
    scheduleDeferredPromise = scheduleDeferred.promise.then(function(data) {
      scheduleData_ = data.scheduleData;
      IOWA.Elements.Template.scheduleData = data.scheduleData;
      IOWA.Elements.Template.filterSessionTypes = data.tags.filterSessionTypes;
      IOWA.Elements.Template.filterThemes = data.tags.filterThemes;
      IOWA.Elements.Template.filterTopics = data.tags.filterTopics;

      return scheduleData_;
    });
  }

  /**
   * Fetches the I/O schedule data. If the schedule has not been loaded yet, a
   * network request is kicked off. To wait on the schedule without
   * triggering a request for it, use `schedulePromise`.
   * @return {Promise} Resolves with response schedule data.
   */
  function fetchSchedule() {
    if (scheduleData_) {
      return Promise.resolve(scheduleData_);
    }

    return IOWA.Request.xhrPromise('GET', SCHEDULE_ENDPOINT, false).then(function(resp) {
      scheduleData_ = resp;
      return scheduleData_;
    });
  }

  /**
   * Returns a promise fulfilled when the master schedule is loaded.
   * @return {!Promise} Resolves with response schedule data.
   */
  function schedulePromise() {
    if (!scheduleDeferredPromise) {
      createScheduleDeferred_();
    }

    return scheduleDeferredPromise;
  }

  /**
   * Resolves the schedule-fetching promise.
   * @param {{scheduleData, tags}} data
   */
  function resolveSchedulePromise(data) {
    if (!scheduleDeferredPromiseResolver) {
      createScheduleDeferred_();
    }

    scheduleDeferredPromiseResolver(data);
  }

  /**
   * Fetches the resource from cached value storage or network.
   * If this is the first time it's been called, then uses the cache-then-network strategy to
   * first try to read the data stored in the Cache Storage API, and invokes the callback with that
   * response. It then tries to fetch a fresh copy of the data from the network, saves the response
   * locally in memory, and resolves the promise with that response.
   * @param {string} url The address of the resource.
   * @param {Array} resourceCache A variable name to store the cached resource.
   * @param {function} callback The callback to execute when the user survey data is available.
   */
  function fetchResource(url, resourceCache, callback) {
    if (cache[resourceCache].length) {
      callback(cache[resourceCache]);
    } else {
      var callbackWrapper = function(resource) {
        cache[resourceCache] = resource || [];
        callback(cache[resourceCache]);
      };

      IOWA.Request.cacheThenNetwork(url, callback, callbackWrapper, true);
    }
  }

  /**
   * Fetches the user's saved sessions.
   * If this is the first time it's been called, then uses the cache-then-network strategy to
   * first try to read the data stored in the Cache Storage API, and invokes the callback with that
   * response. It then tries to fetch a fresh copy of the data from the network, saves the response
   * locally in memory, and resolves the promise with that response.
   * @param {function} callback The callback to execute when the user schedule data is available.
   */
  function fetchUserSchedule(callback) {
    fetchResource(SCHEDULE_ENDPOINT_USERS, 'userSavedSessions', callback);
  }

  /**
   * Wait for the master schedule to have loaded, then use `fetchUserSchedule`
   * to fetch the user's schedule and finally bind it for display.
   * loadUserSchedule() doesn't wait for the user to be signed in, so ensure that there is a
   * signed-in user before calling this function.
   */
  function loadUserSchedule() {
    // Only fetch their schedule if the worker has responded with the master schedule.
    schedulePromise().then(function() {
      IOWA.Elements.Template.scheduleFetchingUserData = true;

      // Fetch user's saved sessions.
      fetchUserSchedule(function(savedSessions) {
        var template = IOWA.Elements.Template;
        template.scheduleFetchingUserData = false;
        template.savedSessions = savedSessions;
        updateSavedSessionsUI(template.savedSessions);
      });

      // Fetch user's rated sessions.
      fetchResource(SURVEY_ENDPOINT_USERS, 'userSavedSurveys', function(savedSurveys) {
        var template = IOWA.Elements.Template;
        template.savedSurveys = savedSurveys;
        updateRatedSessions(savedSurveys);
      });
    });
  }

  /**
   * Adds/removes a session from the user's bookmarked sessions.
   * @param {string} sessionId The session to add/remove.
   * @param {Boolean} save True if the session should be added, false if it
   *     should be removed.
   * @return {Promise} Resolves with the server's response.
   */
  function saveSession(sessionId, save) {
    IOWA.Analytics.trackEvent('session', 'bookmark', save ? 'save' : 'remove');

    return IOWA.Auth.waitForSignedIn(
        'Sign in to add events to My Schedule').then(function() {
      IOWA.Elements.Template.scheduleFetchingUserData = true;
      var url = SCHEDULE_ENDPOINT_USERS + '/' + sessionId;
      var method = save ? 'PUT' : 'DELETE';
      return submitSessionRequest(
          url, method, null, 'Unable to modify My Schedule.',
          clearCachedUserSchedule);
    });
  }

  /**
   * Submits session-related request to backend.
   * @param {string} url Request url.
   * @param {string} method Request method, e.g. 'PUT'.
   * @param {Object} payload JSON payload.
   * @param {string} errorMsg Message to be shown on error.
   * @param {function} callback Callback to be called with the resource.
   * @return {Promise} Resolves with the server's response.
   */
  function submitSessionRequest(url, method, payload, errorMsg, callback) {
    return IOWA.Request.xhrPromise(method, url, true, payload)
      .then(callback)
      .catch(function(error) {
        // error will be an XMLHttpRequestProgressEvent if the xhrPromise()
        // was rejected due to a network error.
        // Otherwise, error will be a Error object.
        if ('serviceWorker' in navigator && XMLHttpRequestProgressEvent &&
            error instanceof XMLHttpRequestProgressEvent) {
          IOWA.Elements.Toast.showMessage(
              errorMsg + ' The change will be retried on your next visit.');
        } else {
          IOWA.Elements.Toast.showMessage(errorMsg);
        }
        throw error;
      });

  }

  /**
   * Submits session survey results.
   * @param {string} sessionId The session to be rated.
   * @param {Object} answers An object with question/answer pairs.
   * @return {Promise} Resolves with the server's response.
   */
  function saveSurvey(sessionId, answers) {
    IOWA.Analytics.trackEvent('session', 'rate', sessionId);
    return IOWA.Auth.waitForSignedIn(
        'Sign in to submit feedback').then(function() {
      var url = SURVEY_ENDPOINT_USERS + '/' + sessionId;
      var callback = function(response) {
        IOWA.Elements.Template.savedSurveys = response;
      };
      return submitSessionRequest(
          url, 'PUT', answers, 'Unable to save feedback results.', callback);
    });
  }

  /**
   * Shows a notification when bookmarking/removing a session.
   * @param {Boolean} saved True if the session was saved. False if it was removed.
   * @param {string=} opt_message Optional override message for the
   * "Added to My Schedule" toast.
   */
  function bookmarkSessionNotification(saved, opt_message) {
    var message = opt_message || "You'll get a notification when it starts.";
    var template = IOWA.Elements.Template;

    if (saved) {
      // If IOWA.Elements.Template.dontAutoSubscribe is true, this promise will reject immediately, and we'll just
      // add the session without attempting to auto-subscribe.
      return IOWA.Notifications.subscribePromise(template.dontAutoSubscribe).then(function() {
        IOWA.Elements.Toast.showMessage("Added to My Schedule. " + message);
      }).catch(function(error) {
        template.dontAutoSubscribe = true;
        if (error && error.name === 'AbortError') {
          // AbortError indicates that the subscription couldn't be completed due to the page
          // persmissions for notifications being set to denied.
          IOWA.Elements.Toast.showMessage('Added to My Schedule. Want to enable notifications?', null, 'Learn how', function() {
            window.open('permissions', '_blank');
          });
        } else {
          // If the subscription failed for some other reason, like because we're not
          // auto-subscribing, show the normal toast.
          IOWA.Elements.Toast.showMessage('Added to My Schedule.');
        }
      });
    } else {
      IOWA.Elements.Toast.showMessage('Removed from My Schedule');
    }
  }

  function generateFilters(tags) {
    var filterSessionTypes = [];
    var filterThemes = [];
    var filterTopics = [];

    var sortedTags = Object.keys(tags).map(function(tag) {
      return tags[tag];
    }).sort(function(a, b) {
      if (a.order_in_category < b.order_in_category) {
        return -1;
      }
      if (a.order_in_category > b.order_in_category) {
        return 1;
      }
      return 0;
    });

    for (var i = 0; i < sortedTags.length; ++i) {
      var tag = sortedTags[i];
      switch (tag.category) {
        case 'TYPE':
          filterSessionTypes.push(tag.name);
          break;
        case 'TOPIC':
          filterTopics.push(tag.name);
          break;
        case 'THEME':
          filterThemes.push(tag.name);
          break;
      }
    }

    return {
      filterSessionTypes: filterSessionTypes,
      filterThemes: filterThemes,
      filterTopics: filterTopics
    };
  }

  function updateSavedSessionsUI(savedSessions) {
    //  Mark/unmarked sessions the user has bookmarked.
    var sessions = IOWA.Elements.Template.scheduleData.sessions;
    for (var i = 0; i < sessions.length; ++i) {
      var session = sessions[i];
      session.saved = savedSessions.indexOf(session.id) !== -1;
    }
  }

  function updateRatedSessions(savedSurveys) {
    var sessions = IOWA.Elements.Template.scheduleData.sessions;
    for (var i = 0; i < sessions.length; ++i) {
      var session = sessions[i];
      session.rated = savedSurveys.indexOf(session.id) !== -1;
    }
  }

  function clearCachedUserSchedule() {
    cache.userSavedSessions = [];
  }

  /**
   * Clear all user schedule data from display.
   */
  function clearUserSchedule() {
    var template = IOWA.Elements.Template;
    template.savedSessions = [];
    updateSavedSessionsUI(template.savedSessions);
    clearCachedUserSchedule();
  }

  function getSessionById(sessionId) {
    for (var i = 0; i < scheduleData_.sessions.length; ++i) {
      var session = scheduleData_.sessions[i];
      if (session.id === sessionId) {
        return session;
      }
    }
    return null;
  }

  /**
   * Checks to see if there are any failed schedule update requests queued in IndexedDB, and if so,
   * replays them. Should only be called when auth is available, i.e. after login.
   *
   * @return {Promise} Resolves once the replay attempts are done, whether or not they succeeded.
   */
  function replayQueuedRequests() {
    // Only bother checking for queued requests if we're on a browser with service worker support,
    // since they can't be queued otherwise. This has a side effect of working around a bug in
    // Safari triggered by the simpleDB library.
    if ('serviceWorker' in navigator) {
      return simpleDB.open(QUEUED_SESSION_UPDATES_DB_NAME).then(function(db) {
        var replayPromises = [];
        // forEach is a special method implemented by SimpleDB, and isn't the normal Array.forEach.
        return db.forEach(function(url, method) {
          var replayPromise = IOWA.Request.xhrPromise(method, url, true).then(function() {
            return db.delete(url).then(function() {
              return true;
            });
          });
          replayPromises.push(replayPromise);
        }).then(function() {
          if (replayPromises.length) {
            return Promise.all(replayPromises).then(function() {
              IOWA.Elements.Toast.showMessage('My Schedule was updated with offline changes.');
            });
          }
        });
      }).catch(function() {
        IOWA.Elements.Toast.showMessage('Offline changes could not be applied to My Schedule.');
      });
    } else {
      return Promise.resolve();
    }
  }

  /**
   * Deletes the IndexedDB database used to queue up failed requests.
   * Useful when, e.g., the user has logged out.
   *
   * @return {Promise} Resolves once the IndexedDB database is deleted.
   */
  function clearQueuedRequests() {
    return simpleDB.delete(QUEUED_SESSION_UPDATES_DB_NAME);
  }

  return {
    bookmarkSessionNotification: bookmarkSessionNotification,
    clearCachedUserSchedule: clearCachedUserSchedule,
    fetchSchedule: fetchSchedule,
    schedulePromise: schedulePromise,
    resolveSchedulePromise: resolveSchedulePromise,
    fetchUserSchedule: fetchUserSchedule,
    loadUserSchedule: loadUserSchedule,
    saveSession: saveSession,
    saveSurvey: saveSurvey,
    generateFilters: generateFilters,
    getSessionById: getSessionById,
    updateSavedSessionsUI: updateSavedSessionsUI,
    replayQueuedRequests: replayQueuedRequests,
    clearQueuedRequests: clearQueuedRequests,
    clearUserSchedule: clearUserSchedule
  };

})();
