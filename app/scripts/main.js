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

  exports.IOWA = exports.IOWA || {};

  // TODO(ericbidelman): add i18n support.
  // if (exports.DEV) {
  //   // Polyfill needs I18nMsg to exist before setting the lang. Timing is fine for native.
  //   // Set locale for entire site (e.g. i18n-msg elements).
  //   document.addEventListener('HTMLImportsLoaded', function() {
  //     I18nMsg.lang = document.documentElement.lang || 'en';
  //   });
  // }

  exports.onerror = function(message, file, lineNumber) {
    // We don't want to trigger any errors inside window.onerror, so wrap in a try/catch.
    try {
      IOWA.Analytics.trackError(file + ':' + lineNumber, message);
    } catch (e) {
      // no-op
    }
  };

  function injectPage(url) {
    var parts = url.split('/');
    var pageName = parts[parts.length - 1].split('.html')[0] || 'home';

    var importURL = 'templates/' + pageName + '_partial.html';

    Polymer.import([importURL], function() {
      // Don't proceed if import didn't load correctly.
      var htmlImport = document.querySelector(
          'link[rel="import"][href="' + importURL + '"]');
      if (htmlImport && !htmlImport.import) {
        return;
      }

      // Note: this element cannot be in elements.js. The auto-binding template
      // may not have been stamped yet.
      var templateToReplace = document.getElementById('template-content-container');

      var newTemplateId = 'template-' + pageName;

      // Use the new template from the injected page.
      templateToReplace.setAttribute('ref', newTemplateId);

      // If template is newly fetched, add it to the DOM for re-use later.
      var newTemplate = document.getElementById(newTemplateId);
      if (!newTemplate) {
        var importContent = htmlImport.import;
        newTemplate = importContent.getElementById(newTemplateId);
        document.body.appendChild(newTemplate);
      }

      // Update sections of the page.
      document.body.id = 'page-' + pageName;
      IOWA.Elements.Template.selectedPage = pageName;

      var mastheadTitle = IOWA.Elements.Template.pages[pageName].mastheadHTML;
      // Note: this element cannot be in elements.js. The auto-binding template
      // may not have been stamped yet.
      var titleContainer = document.getElementById('masthead-title-container');
      IOWA.Elements.Template.injectBoundHTML(mastheadTitle, titleContainer);

      // update meta data
      // update title
      // update nav selections

      // Update URL.
      history.pushState({}, null, url);
    });
  }

  // TODO: do this off routing change instead of link clicks.
  document.addEventListener('click', function(e) {
    // Inject page if <a> was in the event path and matches ajax criteria:
    // - is a different page.
    // - was relative link and not javascript:
    // - not a #hash link within the same page
    // - is not going to a non-ajaxable page (index.html, apps, components, etc.)
    // - was not targeted at a new window
    for (var i = 0; i < e.path.length; ++i) {
      var el = e.path[i];
      if (el.localName == 'a') {
        if (!el.getAttribute('href').match(/^(https?:|javascript:|\/\/)/) &&
            location.origin == el.origin &&
            !(el.hash && (el.pathname == location.pathname)) &&
             el.target == '') {
          e.preventDefault();
          e.stopPropagation();

          injectPage(el.href);
        }

        return; // found first anchor, quit here.
      }
    }
  });

  document.addEventListener('template-bound', function() {
    injectPage(location.href);
  });

})(window);
