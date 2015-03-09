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

IOWA.Elements = (function() {
  "use strict";

  var updateElements = function() {
    var ioLogo = document.querySelector('io-logo');
    ioLogo.addEventListener('io-logo-animation-done', function() {
      var optionallyLaunchExperiment = function() {
        if (window.location.search.indexOf('experiment') > -1) {
          IOWA.Elements.FAB.onFabClick();
        }
      };

      IOWA.PageAnimation.play(IOWA.PageAnimation.pageFirstRender(), function() {
        // Fire event when the page transitions are final.
        IOWA.Elements.Template.fire('page-transition-done');

        optionallyLaunchExperiment();
        IOWA.ServiceWorkerRegistration.register();
      });
    });

    var main = document.querySelector('.io-main');

    var drawer = document.querySelector('core-drawer-panel');
    drawer.addEventListener('core-activate', function(e) {
      this.closeDrawer();
    });

    var masthead = document.querySelector('.masthead');
    var mastheadMeta = masthead.querySelector('.masthead-meta');
    var ioLogoLarge = masthead.querySelector('.io-logo.large');
    var nav = masthead.querySelector('#navbar');
    var navPaperTabs = nav.querySelector('paper-tabs');
    var drawerMenu = document.getElementById('drawer-menu');
    var fab = masthead.querySelector('experiment-fab-container');
    var footer = document.querySelector('footer');
    var toast = document.getElementById('toast');
    var i18n = document.createElement('i18n-msg');

    var ripple = masthead.querySelector('.masthead__ripple__content');
    IOWA.Util.resizeRipple(ripple);

    IOWA.Elements.Drawer = drawer;
    IOWA.Elements.I18n = i18n;
    IOWA.Elements.Masthead = masthead;
    IOWA.Elements.MastheadMeta = mastheadMeta;
    IOWA.Elements.Main = main;
    IOWA.Elements.Nav = nav;
    IOWA.Elements.DrawerMenu = drawerMenu;
    IOWA.Elements.NavPaperTabs = navPaperTabs;
    IOWA.Elements.Ripple = ripple;
    IOWA.Elements.FAB = fab;
    IOWA.Elements.Toast = toast;
    IOWA.Elements.IOLogo = ioLogo;
    IOWA.Elements.IOLogoLarge = ioLogoLarge;
    IOWA.Elements.Footer = footer;
  };

  var init = function() {
    var template = document.getElementById('t');
    template.pages = IOWA.PAGES; // defined in auto-generated ../pages.js
    template.selectedPage = IOWA.Router.getPageName(window.location.pathname);
    template.fullscreenVideoActive = false;
    template.photoGalleryActive = false;
    template.extendedMapActive = false;
    template.pageTransitionDone = false;
    template.offsiteGlobeVisible = false;
    template.homeGlobeVisible = false;
    template.selectedCity = null;
    template.offsiteMarkerResults = [];

    template.rippleColors = {
      'bg-cyan': '#00BCD4',
      'bg-medium-grey': '#CFD8DC',
      'bg-dark-grey': '#455A64'
    };

    template.mastheadBgClass = template.pages[template.selectedPage].mastheadBgClass;
    template.navBgClass = template.mastheadBgClass;

    template.scrollLock = function(enable) {
      document.body.classList.toggle('noscroll', enable);
    };

    template.toggleVideoOverlayNav = function() {
      var nav = document.querySelector('.navbar__overlay--video');
      nav.classList.toggle('active');
    };

    template.closeVideoCard = function(e, detail, sender) {
      this.cardVideoTakeover(this.currentCard, true);
      this.toggleVideoOverlayNav();
    };

    /**
     * Material design video animation.
     *
     * @param {Element} card The card element to perform the takeover on.
     * @param {bool} opt_reverse If true, runs the animation in reverse.
     */
    template.cardVideoTakeover = function(card, opt_reverse) {
      if (!card) {
        return;
      }

      var reverse = opt_reverse || false;

      // Forward animation sequence. The reverse sequence is played when reverse == true.
      // 1. Fade out the play button on the card.
      // 2. Transform/scale the video container down to the location and size of the clicked card.
      // 3. Remove 2's transform. This scales up video container to fill the viewport.
      // 4. Drop down the video controls overlay bar.
      // 5. Auto-play the video (on desktop). When it reaches the playing state, fade out the video thumbnail.

      var cardPhoto = card.querySelector('.card__photo');
      var videoContainer = document.querySelector('.fullvideo__container');
      var video = videoContainer.querySelector('.fullvideo__container google-youtube');

      var thumbnail = videoContainer.querySelector('.fullvideo_thumbnail');
      var playButton = card.querySelector('.play__button');

      var cardPhotoMetrics = cardPhoto.getBoundingClientRect();

      var viewportWidth = document.documentElement.clientWidth;
      var viewportHeight = document.documentElement.clientHeight;

      var scaleX = cardPhotoMetrics.width / viewportWidth;
      var scaleY = cardPhotoMetrics.height / viewportHeight;
      var top = cardPhotoMetrics.top + window.scrollY;

      video.pause(); // Pause a running video.

      var playButtonPlayer = playButton.animate([{opacity: 1}, {opacity: 0}], {
        duration: 350,
        iterations: 1,
        fill: 'forwards',
        easing: 'cubic-bezier(0,0,0.21,1)',
        direction: reverse ? 'reverse' : 'normal'
      });

      playButtonPlayer.onfinish = function(e) {

        var startTransform = 'translate(' + cardPhotoMetrics.left + 'px, ' + top + 'px) ' +
                             'scale(' + scaleX + ', ' + scaleY + ')';

        if (!reverse) {
          // Scale down the video container before unhiding it.
          // TODO(ericbidelman): shouldn't have to do this. The initial state
          // is setup in the animate() below.
          videoContainer.style.transform = videoContainer.style.webkitTransform = startTransform;
        } else {
          // Fade in thumbnail before shrinking.
          thumbnail.classList.remove('fadeout');
        }

        // Container is shrunk and in the card's location.
        // Unhide it so thumbnail is visible.
        videoContainer.hidden = false;

        var player = videoContainer.animate([
          {transform: startTransform},
          {transform: 'translate(0, 0) scale(1)'}
        ], {
          duration: 400,
          direction: reverse ? 'reverse' : 'normal',
          iterations: 1,
          fill: 'forwards',
          easing: 'cubic-bezier(0.4,0,0.2,1)'
        });

        player.onfinish = function(e) {
          if (reverse) {
            this.fullscreenVideoActive = false; // remove from DOM.
            this.currentCard = null;
          } else {
            thumbnail.classList.add('fadeout');
            this.toggleVideoOverlayNav(); // Drop down back button control.
          }
        }.bind(this);
      }.bind(this);
    };

    template.playVideo = function(e, detail, sender) {
      this.currentCard = sender;
      this.fullscreenVideoActive = true; // Active the placeholder template.

      IOWA.Analytics.trackEvent('link', 'click', sender.getAttribute('data-track-link'));

      // Wait one rAF for template to have stamped.
      this.async(function() {
        this.cardVideoTakeover(this.currentCard);
      });
    };

    template.openShareWindow = function(e, detail, sender) {
      e.preventDefault();

      var type = sender.getAttribute('data-share-type');
      var width = 600;
      var height = 600;

      var url = null;
      switch (type) {
        case 'fb':
          height = 229;
          url = 'https://www.facebook.com/sharer.php?u=' +
                encodeURIComponent(location.href) +
                '&t=' + encodeURIComponent(document.title);
          break;

        case 'gplus':
          height = 348;
          width = 512;
          url = 'https://plus.google.com/share?url=' +
                encodeURIComponent(location.href) +
                '&hl=' + encodeURIComponent(document.documentElement.lang);
          break;

        case 'twitter':
          height = 253;
          var el = document.getElementById('share-text');

          url = 'https://twitter.com/intent/tweet?text=' +
                encodeURIComponent(el.textContent || 'Google I/O 2015');
          break;

        default:

          return;
      }

      var options = 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=' +
                    height + ',width=' + width;
      window.open(url, 'share', options);
    };

    template.backToTop = function(e, detail, sender) {
      e.preventDefault();
      IOWA.Util.smoothScroll(IOWA.Elements.Nav, 250);
      this.focusNavigation();
    };

    template.focusNavigation = function() {
      IOWA.Elements.NavPaperTabs.items[0].firstElementChild.focus();
    };

    // If the Home button was clicked, move focus to the About button
    // after the Home button has faded out
    template.manageHomeFocus = function(e, detail, sender) {
      if (this.selectedPage == 'home') {
        this.focusNavigation();
      }
    };

    template.addEventListener('template-bound', updateElements);
    template.addEventListener('page-transition-done', function(e) {
      this.pageTransitionDone = true;
      IOWA.Elements.NavPaperTabs.style.pointerEvents = '';
    });
    template.addEventListener('page-transition-start', function(e) {
      this.pageTransitionDone = false;
      IOWA.Elements.NavPaperTabs.style.pointerEvents = 'none';
    });

    IOWA.Elements.Template = template;
    IOWA.Elements.ScrollContainer = document.querySelector(
        'core-drawer-panel [main]');
    template.ScrollContainer = IOWA.Elements.ScrollContainer;
  };

  return {
    init: init
  };
})();
