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

(function(exports) {
  'use strict';

  // @codekit-prepend '../bower_components/js-signals/dist/signals.min.js'

  exports.IOWA = {};

  // TODO: Make the codekit syntax work with gulp.
  // @codekit-append 'bootstrap.js'
})(window);

window.onerror = function(message, file, lineNumber) {
  try {
    IOWA.Analytics.trackError(file + ':' + lineNumber, message);
  } catch (e) {
    // No-op to make sure we don't trigger an exception from within the global exception handler.
  }
};
