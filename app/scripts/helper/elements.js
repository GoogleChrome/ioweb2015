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
      IOWA.PageAnimation.play(IOWA.PageAnimation.pageFirstRender(), function() {
        // Fire event when the page transitions are final.
        IOWA.Elements.Template.fire('page-transition-done');
      });
    });

    var main = document.querySelector('.io-main');

    var drawer = document.querySelector('core-drawer-panel');
    drawer.addEventListener('core-activate', function(e) {
      this.closeDrawer();
    });

    var ripple = document.querySelector('.masthead__ripple__content');
    IOWA.Util.resizeRipple(ripple);

    var masthead = document.querySelector('.masthead');
    var mastheadMeta = document.querySelector('.masthead-meta');
    var footer = document.querySelector('footer');
    var toast = document.getElementById('toast');
    var i18n = document.createElement('i18n-msg');

    var ioLogoLarge = masthead.querySelector('.io-logo.large');
    var nav = masthead.querySelector('#navbar');

    IOWA.Elements.Drawer = drawer;
    IOWA.Elements.I18n = i18n;
    IOWA.Elements.Masthead = masthead;
    IOWA.Elements.MastheadMeta = mastheadMeta;
    IOWA.Elements.Main = main;
    IOWA.Elements.Nav = nav;
    IOWA.Elements.Ripple = ripple;
    IOWA.Elements.Toast = toast;
    IOWA.Elements.IOLogo = ioLogo;
    IOWA.Elements.IOLogoLarge = ioLogoLarge;
    IOWA.Elements.Footer = footer;
  };

  var init = function() {
    var template = document.getElementById('t');
    template.pages = {};
    template.selectedPage = IOWA.Router.getPageName(window.location.pathname);
    template.fullscreenVideoActive = false;

    template.rippleColors = {
      'bg-cyan': '#00BCD4',
      'bg-medium-grey': '#CFD8DC',
      'bg-dark-grey': '#455A64'
    };

    template.pages = {
      'schedule': {
        mastheadBgClass: 'bg-cyan'
      },
      'home': {
        mastheadBgClass: 'bg-medium-grey'
      },
      'about': {
        mastheadBgClass: 'bg-dark-grey'
      },
      'onsite': {
        mastheadBgClass: 'bg-dark-grey'
      },
      'offsite': {
        mastheadBgClass: 'bg-cyan'
      },
      'registration': {
        mastheadBgClass: 'bg-cyan'
      }
    };

    template.mastheadBgClass = template.pages[template.selectedPage].mastheadBgClass;
    template.navBgClass = template.mastheadBgClass;

    template.toggleOverlayNav = function() {
      var nav = document.querySelector('.navbar--overlay');

      // If overlay bar is down, stop
      if (nav.classList.contains('active')) {
        this.cardVideoTakeover(this.currentCard, true);
      }

      nav.classList.toggle('active');
      this.fire('overlay-navbar-toggle', nav.classList.contains('active'));
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
            var onStateChange = function(e) {
              if (e.detail.data == 1) { // Playing state is video.state == 1.
                thumbnail.classList.add('fadeout');

                video.removeEventListener('google-youtube-state-change', onStateChange);
              }
            }.bind(this);

            if (video.playsupported) {
              video.play();
              video.addEventListener('google-youtube-state-change', onStateChange);
            } else {
              // If video can't auto-play, fade out thumbnail and toggle navbar.
              thumbnail.classList.add('fadeout');
            }

            this.toggleOverlayNav(); // Drop down back button control.
          }

        }.bind(this);

      }.bind(this);
    };

    template.playVideo = function(e, detail, sender) {
      this.currentCard = sender;
      this.fullscreenVideoActive = true; // Stamp the template's DOM.
    };

    template.videoReady = function(e, detail, sender) {
      this.cardVideoTakeover(this.currentCard);
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
          var el = document.getElementById('share-dialog-text');

          url = 'https://twitter.com/share?text=' +
                encodeURIComponent(el.textContent || 'Google I/O 2015') +
                '&url=' + encodeURIComponent(location.href);
        break;

        default:

        return;
      }

      var options = 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=' +
                    height + ',width=' + width;
      window.open(url, 'share', options);
    };

    template.addEventListener('template-bound', updateElements);

    IOWA.Elements.Template = template;
    IOWA.Elements.ScrollContainer = document.querySelector(
        'core-drawer-panel > div[main]');
  };

  return {
    init: init
  };
})();
