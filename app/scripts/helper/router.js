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

 /**
  * @fileOverview The ajax-based routing for IOWA subpages.
  */

IOWA.Router_ = function(window) {

  "use strict";

  var MASTHEAD_BG_CLASS_REGEX = /(\s|^)bg-[a-z-]+(\s|$)/;

  /**
   * Replaces in-page <script> tag in xhr'd body content with runnable script.
   *
   * @param {Node} node Container element to replace script content.
   * @private
   */
  function replaceScriptTagWithRunnableScript(node) {
    var script = document.createElement('script');
    script.text = node.text || node.textContent || node.innerHTML;
    // IE doesn't execute the script when it's appended to the middle
    // of the DOM. Append it to body instead, then remove.
    if (IOWA.Util.isIE()) {
      document.body.appendChild(script);
      document.body.removeChild(script);
    } else {
      node.parentNode.replaceChild(script, node); // FF
    }
  }

  /**
   * @constructor
   */
  var Router = function() {};

  /**
   * Keeps info about the router state at the start, during and
   *     after page transition.
   * @type {Object}
   */
  Router.prototype.state = {
    start: null,
    current: null,
    end: null
  };

  /**
   * Initializes the router.
   * @param {Object} template IOWA.Elements.Template reference.
   */
  Router.prototype.init = function(template) {
    this.t = template;
    this.state.current = this.parseUrl(window.location.href);
    window.addEventListener('popstate', function() {
      this.navigate(window.location.href, 'page-slide-transition');
    }.bind(this));

    // On iOS, we don't have event bubbling to the document level.
    // http://www.quirksmode.org/blog/archives/2010/09/click_event_del.html
    var eventName = IOWA.Util.isIOS() || IOWA.Util.isTouchScreen() ?
        'touchstart' : 'click';

    document.addEventListener(eventName, this.onClick.bind(this));
  };

  /**
   * Handles all clicks on the document. Navigates to a new page state via
   *    ajax if the link has data-ajax-link attribute.
   * @param {Event} e Event that triggered navigation.
   * @private
   */
  Router.prototype.onClick = function(e) {
    // Allow user to open page in a new tab.
    if (e.metaKey || e.ctrlKey) {
      return;
    }
    // Inject page if <a> has the data-ajax-link attribute.
    for (var i = 0; i < e.path.length; ++i) {
      var el = e.path[i];
      if (el.localName === 'a') {
        // First, record click event if link requests it.
        if (el.hasAttribute('data-track-link')) {
          IOWA.Analytics.trackEvent(
              'link', 'click', el.getAttribute('data-track-link'));
        }
        // Ignore links that go offsite.
        if (el.target) {
          return;
        }
        // Use IOWA.Util.smoothScroll for scroll links.
        if (el.getAttribute('data-transition') == 'smooth-scroll') {
          e.preventDefault();
          return;
        }
        if (el.hasAttribute('data-ajax-link')) {
          e.preventDefault();
          e.stopPropagation();
          this.navigate(el.href, e, el);
        }
        return; // found first navigation element, quit here.
      }
    }
  };

  /**
   * Transition name (data-transition attribute) to transition function map.
   * @type {Object}
   * @private
   */
  Router.pageExitTransitions = {
    'masthead-ripple-transition': 'playMastheadRippleTransition',
    'hero-card-transition': 'playHeroTransitionStart',
    'page-slide-transition': 'playPageSlideOut'
  };

  /**
   * Transition name (data-transition attribute) to transition function map.
   * @type {Object}
   * @private
   */
  Router.pageEnterTransitions = {
    'masthead-ripple-transition': 'playPageSlideIn',
    'hero-card-transition': 'playHeroTransitionEnd',
    'page-slide-transition': 'playPageSlideIn'
  };

  /**
   * Imports the content of a new page via HTML Import.
   * @return {Promise}
   * @private
   */
  Router.prototype.importPage = function() {
    var pageName = this.state.end.page;

    return new Promise(function(resolve, reject) {
      Polymer.Base.importHref(pageName + '?partial', function(e) {
        // Don't proceed if import didn't load correctly.
        var htmlImport = e.target.import;
        // FF doesn't execute the <script> inside the main content <template>
        // (inside page partial import). Instead, the first time the partial is
        // loaded, find any script tags in and make them runnable by appending
        // them back to the template.
        if (IOWA.Util.isFF() || IOWA.Util.isIE()) {
          var contentTemplate = document.querySelector(
             '#template-' + pageName + '-content');
          if (!contentTemplate) {
            var containerTemplate = htmlImport.querySelector(
                '[data-ajax-target-template="template-content-container"]');
            var scripts = containerTemplate.content.querySelectorAll('script');
            Array.prototype.forEach.call(scripts, function(node, i) {
              replaceScriptTagWithRunnableScript(node);
            });
          }
        }
        // Update content of the page.
        resolve(htmlImport);
      }, function(e) {
        console.error('Page could not be dynamically loaded', e);
        IOWA.Util.reportError(e);
        reject(e);
      }, true);
    });
  };

  /**
   * Swaps in partial from new imported template content.
   * @return {Promise}
   * @private
   */
  Router.prototype.renderTemplates = function(importContent) {
    var pageName = this.state.end.page;

    return new Promise(function(resolve, reject) {
      // Add freshly fetched templates to DOM, if not yet present.
      var newTemplates = importContent.querySelectorAll('.js-ajax-template');
      for (var i = 0; i < newTemplates.length; ++i) {
        var newTmpl = newTemplates[i];
        if (!document.getElementById(newTmpl.id)) {
          document.body.appendChild(newTmpl);
        }
      }
      // Replace current templates content with new one.
      var existingTemplates = document.querySelectorAll('.js-ajax-' + pageName);
      for (var j = 0; j < existingTemplates.length; ++j) {
        var tmpl = existingTemplates[j];
        var template = document.getElementById(
            tmpl.getAttribute('data-ajax-target-template'));
        if (template) {
          // template.setAttribute('ref', tmpl.id);
          template.innerHTML = '';
          // var content = document.importNode(tmpl.content, true);
          var content = tmpl.content;
          // var content = tmpl.stamp().root;

          // TODO: polymer 1.0 update. Find solution for dynamic pages.
          // For page transitions, content does not contain upgraded elements.
          template.appendChild(content);
        }
      }

      // Wait for the template ref= to settle.
      // IOWA.Elements.Template.async(function() {
        resolve();
      // });
    });
  };

  /**
   * Runs custom page handlers for load and unload, if present.
   * @param {string} funcName 'load', 'unload' or 'onPageTransitionDone'.
   * @param {pageName} pageName Page that owns the handler.
   * @return {Promise}
   * @private
   */
  Router.prototype.runPageHandler = function(funcName, pageName) {
    var template = this.t;
    return new Promise(function(resolve, reject) {
      var page = template.pages[pageName];
      if (page && page[funcName]) {
        // If page we're going to has a load handler, run it.
        page[funcName]();
      }
      resolve();
    });
  };

  /**
   * Updates the state of UI elements based on the current state of the router.
   * @private
   */
  Router.prototype.updateUIstate = function() {
    var pageName = this.state.current.page;
    var pageMeta = this.t.pages[pageName];

    // Update menu/drawer/subtabs selected item.
    this.t.selectedPage = pageName;
    // this.t.pages[pageName].selectedSubpage = this.state.current.subpage;
    this.t.set(['pages', pageName, 'selectedSubpage'], this.state.current.subpage);

    IOWA.Elements.DrawerMenu.selected = pageName;

    // Update some elements only if navigating to a new page.
    if (this.state.current.page !== this.state.start.page) {
      document.body.id = 'page-' + pageName;
      document.title = pageMeta.title || 'Google I/O 2015';
      IOWA.Util.setMetaThemeColor(
          IOWA.Elements.Template.rippleColors[pageMeta.mastheadBgClass]);

      // This cannot be updated via data binding, because the masthead
      // is visible before the binding happens.
      IOWA.Elements.Masthead.className = IOWA.Elements.Masthead.className.replace(
        MASTHEAD_BG_CLASS_REGEX, ' ' + pageMeta.mastheadBgClass + ' ');
      // Reset subpage, since leaving the page.
      var startPage = this.state.start.page;
      // this.t.pages[startPage].selectedSubpage = startPage.defaultSubpage;
      this.t.set(['pages', startPage, 'selectedSubpage'], startPage.defaultSubpage);
      // Scroll to top of new page.
      IOWA.Elements.ScrollContainer.scrollTop = 0;
    }
    // Show correct subpage.
    var subpages = IOWA.Elements.Main.querySelectorAll('.subpage__content');
    var selectedSubpageSection = IOWA.Elements.Main.querySelector(
        '.subpage-' + this.state.current.subpage);
    if (selectedSubpageSection) {
      for (var i = 0; i < subpages.length; i++) {
        var subpage = subpages[i];
        subpage.style.display = 'none';
        subpage.classList.remove('active');
      }
      selectedSubpageSection.style.display = '';
      selectedSubpageSection.classList.add('active');
    }
    // If current href is different than the url, update it in the browser.
    if (this.state.current.href !== window.location.href) {
      history.pushState({
        'path': this.state.current.path + this.state.current.hash
      }, '', this.state.current.href);
    }
  };

  /**
   * Runs full page transition. The order of the transition:
   *     + Start transition.
   *     + Play old page exit animation.
   *     + Run old page's custom unload handlers.
   *     + Load the new page.
   *     + Update state of the page in Router to the new page.
   *     + Update UI state based on the router's.
   *     + Run new page's custom load handlers.
   *     + Play new page entry animation.
   *     + End transition.
   * TODO: Limit usage of bind() for performance.
   * @param {Event} e Event that triggered the transition.
   * @param {Element} source Element that triggered the transition.
   * @private
   */
  Router.prototype.runPageTransition = function(e, source) {
    var transitionAttribute = source ?
        source.getAttribute('data-transition') : null;
    var transition = transitionAttribute || 'page-slide-transition';
    var router = this;
    // Start transition.
    router.t.fire('page-transition-start');
    // Play exit sequence.
    IOWA.PageAnimation[Router.pageExitTransitions[transition]](
        this.state.start.page, this.state.end.page, e, source)
      // Run page's custom unload handlers.
      .then(this.runPageHandler.bind(this, 'unload', this.state.start.page))
      // Fetch the content of the new page.
      .then(this.importPage.bind(this))
      .then(function(htmlImport) {
        return new Promise(function(resolve, reject) {
          // Run page's custom load handlers.
          this.runPageHandler('load', router.state.end.page);
          resolve(htmlImport);
        }.bind(this));
      }.bind(this))
      // Render the content of the new page.
      .then(this.renderTemplates.bind(this))
      .then(function() {
        return new Promise(function(resolve, reject) {
          // Update state of the page in Router.
          router.state.current = router.parseUrl(router.state.end.href);
          // Update UI state based on the router's state.
          router.updateUIstate();
          resolve();
        });
      })
      // Play entry sequence.
      .then(IOWA.PageAnimation[Router.pageEnterTransitions[transition]])
      .then(function() {
        // End transition.
        router.t.fire('page-transition-done');
        // Run page's custom onPageTransitionDone handlers.
        router.runPageHandler('onPageTransitionDone', router.state.current.page);
      }).catch(function(e) {
        console.error(e);
        IOWA.Util.reportError(e);
      });
  };

  /**
   * Runs subpage transition. The order of the transition:
   *     + Play old subpage slide out animation.
   *     + Update state of the page in Router to the new page.
   *     + Update UI state based on the router's.
   *     + Play new subpage slide in animation.
   * @private
   */
  Router.prototype.runSubpageTransition = function() {
    var oldSubpage = IOWA.Elements.Main.querySelector(
        '.subpage-' + this.state.start.subpage);
    var newSubpage = IOWA.Elements.Main.querySelector(
        '.subpage-' + this.state.end.subpage);
    var router = this;

    // Run subpage transition if both subpages exist.
    if (oldSubpage && newSubpage) {
      // Play exit sequence.
      IOWA.PageAnimation.playSectionSlideOut(oldSubpage)
        .then(function() {
          // Update current state of the page in Router and Template.
          router.state.current = router.parseUrl(router.state.end.href);
          // Update UI state based on the router's state.
          return router.updateUIstate();
        })
        // Play entry sequence.
        .then(IOWA.PageAnimation.playSectionSlideIn.bind(null, newSubpage))
        .then(this.runPageHandler.bind(
            this, 'onSubpageTransitionDone', router.state.current.page));
    }
  };

  /**
   * Navigates to a new state.
   * @param {string} href URL describing the new state.
   * @param {Event} e Event that triggered the transition.
   * @param {Element} source Element that triggered the transition.
   * @private
   */
  Router.prototype.navigate = function(href, e, source) {
    // Copy current state to startState.
    this.state.start = this.parseUrl(this.state.current.href);
    this.state.end = this.parseUrl(href);
    // Navigate to a new page.
    if (this.state.start.page !== this.state.end.page) {
      this.runPageTransition(e, source);
    } else if (this.state.start.subpage !== this.state.end.subpage) {
      this.runSubpageTransition();
    }
  };

  /**
   * Extracts page's state from the url.
   * Url structure:
   *    http://<origin>/io2015/<page>?<search>#<subpage>/<resourceId>
   * @param {string} url The page's url.
   * @return {Object} Page's state.
   */
  Router.prototype.parseUrl = function(url) {
    var parser = new URL(url);
    var hashParts = parser.hash.replace('#', '').split('/');
    var params = {};
    if (parser.search) {
      var paramsList = parser.search.replace('?', '').split('&');
      for (var i = 0; i < paramsList.length; i++) {
        var paramsParts = paramsList[i].split('=');
        params[paramsParts[0]] = decodeURIComponent(paramsParts[1]);
      }
    }
    var page = parser.pathname.replace(window.PREFIX + '/', '') || 'home';
    // If pages data is accessible, find default subpage.
    var pageMeta = (this.t && this.t.pages) ? this.t.pages[page] : null;
    var defaultSubpage = pageMeta ? pageMeta.defaultSubpage : '';
    // Get subpage from url or set to the default subpage for this page.
    var subpage = hashParts[0] || defaultSubpage;
    return {
      'pathname': parser.pathname,
      'search': parser.search,
      'hash': parser.hash,
      'href': parser.href,
      'page': page,
      'subpage': subpage,
      'resourceId': hashParts[1],
      'params': params
    };
  };

  /**
   * Builds a url from the page's state details.
   * Url structure:
   *    http://<origin>/io2015/<page>?<search>#<subpage>/<resourceId>
   * @param {string} page Name of the page.
   * @param {string} subpage Name of the subpage.
   * @param {string} resourceId Resource identifier.
   * @param {string} search Encoded search string.
   */
  Router.prototype.composeUrl = function(page, subpage, resourceId, search) {
    return [window.location.origin, window.PREFIX, '/', page, search,
        '#', subpage || '', '/', resourceId || ''].join('');
  };

  return new Router();
};
