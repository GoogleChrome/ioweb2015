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

// If there is no shed config (i.e. because we're running in a dev environment and don't want to
// cache things, then just use a default config variable.
var shedConfigFile = 'scripts/auto_generated/shed-config.js';
try {
  importScripts(shedConfigFile);
} catch (e) {
  console.log('Unable to load shed configuration from', shedConfigFile);
  ShedConfig = {
    filesToPrecache: []
  };
}

importScripts('bower_components/shed/dist/shed.js');
importScripts('scripts/shed-offline-analytics.js');

shed.precache(ShedConfig.filesToPrecache);
