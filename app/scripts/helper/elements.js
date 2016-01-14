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

  const ANALYTICS_LINK_ATTR = 'data-track-link';

  function optionallyLaunchExperiment() {
    if (window.location.search.indexOf('experiment') > -1) {
      IOWA.Elements.FAB.onFabClick();
    }
  }

  function disableDrawerIfNotMobile(mq) {
    // Disable swiping drawer on tablet/desktop.
    var isPhoneSize = mq.queryMatches;
    IOWA.Elements.Drawer.querySelector('[drawer]').hidden = !isPhoneSize;
    IOWA.Elements.Drawer.disableSwipe = !isPhoneSize;
  }

  function updateElements() {
    var ioLogo = document.querySelector('io-logo');
    ioLogo.addEventListener('io-logo-animation-done', function(e) {
      // Load auth after logo transition is done. This helps timing with
      // fetching user's schedule and makes sure the worker has returned
      // the main schedule data.
      IOWA.Elements.GoogleSignIn.load = true;

      // Deep link into a subpage.
      var t = IOWA.Elements.Template;
      var parsedUrl = IOWA.Router.parseUrl(window.location.href);
      var defaultSubpage = t.pages[t.selectedPage].defaultSubpage;
      var selectedSubpage = parsedUrl.subpage || defaultSubpage;
      var subpage = document.querySelector('.subpage-' + selectedSubpage);
      if (subpage) {
        t.set(['pages', t.selectedPage, 'selectedSubpage'], selectedSubpage);
        subpage.classList.add('active');
      }

      IOWA.PageAnimation.play(
        IOWA.PageAnimation.pageFirstRender(subpage), function() {
          // Fire event when the page transitions are final.
          IOWA.Elements.Template.fire('page-transition-done');
          // Run page's custom onPageTransitionDone handlers, if present.
          if (t.pages[t.selectedPage].onPageTransitionDone) {
            t.pages[t.selectedPage].onPageTransitionDone();
          }
          optionallyLaunchExperiment();
          IOWA.ServiceWorkerRegistration.register();
        }
      );
    });

    var main = document.querySelector('.io-main');

    var drawer = document.querySelector('paper-drawer-panel');
    drawer.addEventListener('iron-activate', function(e) {
      this.closeDrawer();
    });

    var masthead = document.querySelector('.masthead');
    var mastheadMeta = masthead.querySelector('.masthead-meta');
    var mastheadMetaCorner = masthead.querySelector('.masthead-meta--corner');
    var nav = masthead.querySelector('#navbar');
    var navPaperTabs = nav.querySelector('paper-tabs');
    var drawerMenu = document.getElementById('drawer-menu');
    var fab = masthead.querySelector('.fab');
    var footer = document.querySelector('footer');
    var toast = document.getElementById('toast');
    var liveStatus = document.getElementById('live-status');
    var signin = document.querySelector('google-signin');

    var ripple = masthead.querySelector('.masthead__ripple__content');
    IOWA.Util.resizeRipple(ripple);

    IOWA.Elements.Drawer = drawer;
    IOWA.Elements.Masthead = masthead;
    IOWA.Elements.MastheadMeta = mastheadMeta;
    IOWA.Elements.MastheadMetaCorner = mastheadMetaCorner;
    IOWA.Elements.Main = main;
    IOWA.Elements.Nav = nav;
    IOWA.Elements.DrawerMenu = drawerMenu;
    IOWA.Elements.NavPaperTabs = navPaperTabs;
    IOWA.Elements.Ripple = ripple;
    IOWA.Elements.FAB = fab;
    IOWA.Elements.Toast = toast;
    IOWA.Elements.LiveStatus = liveStatus;
    IOWA.Elements.Footer = footer;
    IOWA.Elements.GoogleSignIn = signin;

    // TODO: consider moving everything under template dom-bind to take advantage
    // of data bindings.
    var phoneMQ = document.getElementById('mq-phone');
    phoneMQ.addEventListener('query-matches-changed', function() {
      disableDrawerIfNotMobile(phoneMQ);
    });
    disableDrawerIfNotMobile(phoneMQ); // Do setup for initial page load.

    // Kickoff a11y helpers for elements
    IOWA.A11y.init();

    // Do top secret stuff.
    // IOWA.Request.xhrPromise('GET', 'api/v1/easter-egg').then(function(response) {
    //   IOWA.Elements.Template.eeFooterLink = response.link;
    // });

// var t = document.createElement('template', 'dom-bind'),
// span = document.createElement('span');
// span.innerHTML = document.getElementById('template-masthead-container').innerHTML;
// t.content.appendChild(span);
// //t.hello = 'hey';
// IOWA.Elements.MastheadMeta.appendChild(t);

// IOWA.Elements.MastheadMeta.appendChild(
        // document.getElementById('template-masthead-container').stamp().root);
// IOWA.Elements.Main.appendChild(
        // document.getElementById('template-content-container').stamp().root);

  }

  function init() {
    var template = document.getElementById('t');
    template.pages = IOWA.PAGES; // defined in auto-generated ../pages.js
    template.selectedPage = IOWA.Router.parseUrl(window.location.href).page;
    template.fullscreenVideoActive = false;
    template.mastheadVideoActive = false;
    template.photoGalleryActive = false;
    template.extendedMapActive = false;
    template.pageTransitionDone = false;
    template.offsiteGlobeVisible = false;
    template.homeGlobeVisible = false;
    template.selectedCity = null;
    template.offsiteMarkerResults = [];
    template.countdownEnded = false;
    template.isIOS = IOWA.Util.isIOS();
    template.scheduleData = null;
    template.savedSessions = [];
    template.eeFooterLink = null;
    template.settingsIOReminder = false;

    // Sign-in defaults.
    template.isSignedIn = false;
    template.currentUser = null;

    // Videos page defaults.
    template.videoList = [];
    template.filteredVideoList = [];

    template.rippleColors = {
      'bg-cyan': '#00BCD4',
      'bg-medium-grey': '#CFD8DC',
      'bg-dark-grey': '#455A64',
      'bg-photo': '#455A64'
    };

    template.mastheadBgClass = template.pages[template.selectedPage].mastheadBgClass;
    template.navBgClass = template.mastheadBgClass;

    IOWA.Util.setMetaThemeColor(
        template.rippleColors[template.mastheadBgClass]);

    template.timezoneNames = {
      'GMT-11:00': {
        'name': 'US/Samoa',
        'title': 'Midway',
        'GMTOffset': -11 * 60
      },
      'GMT-10:00': {
        'name': 'US/Hawaii',
        'title': 'Hawaii-Aleutian Standard Time',
        'GMTOffset': -10 * 60
      },
      'GMT-08:00': {
        'name': 'US/Alaska',
        'title': 'Alaska Daylight Time',
        'GMTOffset': -8 * 60
      },
      'GMT-07:00': {
        'name': 'US/Pacific',
        'title': 'Pacific Daylight Time, Tijuana',
        'GMTOffset': -7 * 60
      },
      'GMT-06:00': {
        'name': 'US/Mountain',
        'title': 'Chihuahua, Mountain Daylight Time, Costa Rica, Regina',
        'GMTOffset': -6 * 60
      },
      'GMT-05:00': {
        'name': 'US/Central',
        'title': 'Central Daylight Time, Mexico City, Bogota',
        'GMTOffset': -5 * 60
      },
      'GMT-04:00': {
        'name': 'US/Eastern',
        'title': 'Eastern Daylight Time, Barbados, Manaus',
        'GMTOffset': -5 * 60
      },
      'GMT-04:30': {
        'name': 'America/Caracas',
        'title': 'Caracas',
        'GMTOffset': -4 * 60 + 30
      },
      'GMT-03:00': {
        'name': 'America/Buenos_Aires',
        'title': 'Halifax, Santiago, São Paulo, Buenos Aires, Nuuk, Montevideo',
        'GMTOffset': -3 * 60
      },
      'GMT-02:30': {
        'name': 'Canada/Newfoundland',
        'title': 'St. John’s',
        'GMTOffset': -2 * 60 + 30
      },
      'GMT-02:00': {
        'name': 'Atlantic/South_Georgia',
        'title': 'South Georgia',
        'GMTOffset': -2 * 60
      },
      'GMT-01:00': {
        'name': 'Atlantic/Cape_Verde',
        'title': 'Cape Verde',
        'GMTOffset': -60
      },
      'GMT-00:00': {
        'name': 'GMT',
        'title': 'Azores',
        'GMTOffset': 0
      },
      'GMT+01:00': {
        'name': 'Europe/London',
        'title': 'Casablanca,Lisbon,London,Windhoek,Brazzaville',
        'GMTOffset': 60
      },
      'GMT+02:00': {
        'name': 'Europe/Amsterdam',
        'title': 'Amsterdam,Belgrade,Brussels,Sarajevo,Cairo,Harare',
        'GMTOffset': 2 * 60
      },
      'GMT+03:00': {
        'name': 'Europe/Moscow',
        'title': 'Amman,Athens,Beirut,Helsinki,Jerusalem,Minsk,Baghdad,Moscow,Kuwait,Nairobi',
        'GMTOffset': 3 * 60
      },
      'GMT+04:00': {
        'name': 'Europe/Moscow',
        'title': 'Tbilisi,Yerevan,Dubai',
        'GMTOffset': 4 * 60
      },
      'GMT+04:30': {
        'name': 'Asia/Tehran',
        'title': 'Tehran, Kabul',
        'GMTOffset': 4 * 60 + 30
      },
      'GMT+05:00': {
        'name': 'Asia/Tehran',
        'title': 'Baku,Karachi,Oral,Yekaterinburg',
        'GMTOffset': 5 * 60
      },
      'GMT+05:45': {
        'name': 'Asia/Kathmandu',
        'title': 'Kathmandu',
        'GMTOffset': 5 * 60 + 45
      },
      'GMT+06:00': {
        'name': 'Asia/Almaty',
        'title': 'Almaty',
        'GMTOffset': 6 * 60
      },
      'GMT+07:00': {
        'name': 'Asia/Jakarta',
        'title': 'Krasnoyarsk, Bangkok, Jakarta',
        'GMTOffset': 7 * 60
      },
      'GMT+08:00': {
        'name': 'Asia/Taipei',
        'title': 'Shanghai,Hong Kong,Irkutsk,Kuala Lumpur,Perth,Taipei',
        'GMTOffset': 8 * 60
      },
      'GMT+09:00': {
        'name': 'Asia/Seoul',
        'title': 'Seoul, Tokyo, Yakutsk',
        'GMTOffset': 9 * 60
      },
      'GMT+09:30': {
        'name': 'Australia/Darwin',
        'title': 'Adelaide, Darwin',
        'GMTOffset': 9 * 60 + 30
      },
      'GMT+10:00': {
        'name': 'Australia/Sydney',
        'title': 'Brisbane,Hobart,Sydney,Vladivostok,Guam,Magadan',
        'GMTOffset': 10 * 60
      },
      'GMT+12:00': {
        'name': 'Pacific/Auckland',
        'title': 'Majuro,Auckland,Fiji',
        'GMTOffset': 12 * 60
      },
      'GMT+13:00': {
        'name': 'Pacific/Tongatapu',
        'title': 'Tongatapu',
        'GMTOffset': 13 * 60
      }
    };

    template.timezones = Object.keys(template.timezoneNames);

    template.prettifyTimezone = function(zone) {
      var z = template.timezoneNames[zone];
      if (z && z.name) {
        return moment.tz(z.name).zoneAbbr();
      }
      return zone;
    };

    template.formatSessionTimeFilter = function(dateStr) {
      var date = new Date(dateStr);
      return date.toLocaleTimeString().replace(/:\d+ /, ' ');
    };

    template.formatSessionDateFilter = function(dateStr) {
      var date = new Date(dateStr);
      var day = date.getDate();
      var month = date.getMonth() + 1;
      if (month === 5) {
        return 'May ' + day;
      } else if (month === 6) {
        return 'June ' + day;
      }
      return day;
    };

    template.featuredSessionsFilter = function(sessions) {
      if (!sessions) {
        return [];
      }
      var superAwesomeSessionId = '21718f8b-b6d4-e411-b87f-00155d5066d7';
      var superAwesomeSession = null;
      var filteredSessions = this.scheduleData.sessions.filter(function(s, i) {
        if (s.id === superAwesomeSessionId) {
          superAwesomeSession = s;
        }
        return s.isFeatured && template.toVideoIdFilter(s.youtubeUrl);
      });
      if (superAwesomeSession) {
        filteredSessions.splice(filteredSessions.indexOf(superAwesomeSession), 1);
        filteredSessions.unshift(superAwesomeSession);
      }
      return filteredSessions;
    };

    template.formatSessionTagsFilter = function(tagList) {
      if (!tagList) {
        return;
      }
      var list = tagList.map(function(tag) {
        tag = this.scheduleData.tags[tag];
        return tag ? tag.name : '';
      }, this);
      return list.join(', ');
    };

    template.speakerIdsToNameString = function(speakers) {
      if (!speakers) {
        return '';
      }
      if (typeof speakers === 'string') {
        return speakers; // speakers is already a "," separated string.
      }
      return speakers.map(function(speakerId) {
        return this.scheduleData.speakers[speakerId].name;
      }.bind(this)).sort().join(', ');
    };

    template.toVideoIdFilter = function(youtubeUrl) {
      if (!youtubeUrl) {
        return youtubeUrl;
      }
      return youtubeUrl.replace(/https?:\/\/youtu\.be\//, '');
    };

    template.limit = function(array, howMany) {
      return array.slice(0, howMany);
    };

    template.scrollLock = function(enable) {
      document.body.classList.toggle('noscroll', enable);
    };

    template.toggleVideoOverlayNav = function() {
      var nav = document.querySelector('.navbar__overlay--video');
      nav.classList.toggle('active');
    };

    template.closeVideoCard = function(e, detail) {
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

    template.playVideo = function(e, detail) {
      this.currentCard = Polymer.dom(e).rootTarget;
      this.fullscreenVideoActive = true; // Active the placeholder template.

      IOWA.Analytics.trackEvent(
          'link', 'click', this.currentCard.getAttribute(ANALYTICS_LINK_ATTR));

      // Wait one rAF for template to have stamped.
      this.async(function() {
        this.cardVideoTakeover(this.currentCard);
      });
    };

    template.openVideo = function(e, detail) {
      var path = Polymer.dom(e).path;

      var target = null;
      for (var i = 0; i < path.length; ++i) {
        var el = path[i];
        if (el.classList && el.classList.contains('card__video')) {
          target = el;
          break;
        }
      }

      if (!target) {
        return;
      }

      this.currentCard = target; // Polymer.dom(e).rootTarget;
      this.fullscreenVideoActive = true; // Activate the placeholder template.

      Polymer.dom.flush();

      // Note: IE10 doesn't support .dataset.
      var videoId = this.toVideoIdFilter(
          this.currentCard.getAttribute('data-videoid'));

      IOWA.Analytics.trackEvent('video', 'watch', videoId);

      var videoContainer = document.querySelector('.fullvideo__container');
      var video = videoContainer.querySelector('google-youtube');

      video.addEventListener('google-youtube-ready', function(e) {
        video.videoId = videoId;
        this.cardVideoTakeover(this.currentCard);
      }.bind(this));

      var thumbnail = videoContainer.querySelector('.fullvideo_thumbnail');
      thumbnail.src = this.currentCard.getAttribute('data-videoimg'); // IE10 doesn't support .dataset.
    };

    template.closeMastheadVideo = function(e, detail) {
      this.mastheadVideoActive = false;
    };

    template.openMastheadVideo = function(e, detail) {
      var target = Polymer.dom(e).rootTarget;

      IOWA.Analytics.trackEvent(
          'link', 'click', target.getAttribute(ANALYTICS_LINK_ATTR));

      this.mastheadVideoActive = true; // stamp template

      Polymer.dom.flush();

      var dialog = IOWA.Elements.Main.querySelector('paper-dialog');
      var video = dialog.querySelector('google-youtube');

      video.addEventListener('google-youtube-ready', function(e) {
        // First session is the keynote.
        // video.videoId = this.toVideoIdFilter(this.scheduleData.sessions[0].youtubeUrl);
        dialog.toggle();
      }.bind(this));
    };

    template.openShareWindow = function(e, detail) {
      e.preventDefault();

      var type = Polymer.dom(e).rootTarget.getAttribute('data-share-type');
      var url = null;
      var width = 600;
      var height = 600;
      var winOptions = 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=' +
                       height + ',width=' + width;

      var title = document.title;
      var summary = null;

// TODO: update for polymer 1.0 port
      var selectedSession = Polymer.dom(e).rootTarget.templateInstance.model.selectedSession;
      if (selectedSession) {
        title = selectedSession.title;
        summary = selectedSession.description;
      }

      // Shorten current URL so it's ready to go.
      IOWA.Util.shortenURL(location.href).then(function(shortURL) {

        switch (type) {
          case 'fb':
            height = 229;
            url = 'https://www.facebook.com/sharer.php?u=' +
                  encodeURIComponent(shortURL) +
                  '&t=' + encodeURIComponent(title);

            break;

          case 'gplus':
            height = 348;
            width = 512;
            url = 'https://plus.google.com/share?url=' +
                  encodeURIComponent(shortURL) +
                  '&hl=' + encodeURIComponent(document.documentElement.lang);
            break;

          case 'twitter':
            height = 253;

            var el = document.getElementById('share-text');
            var text = el.textContent || 'Google I/O 2015';

            if (selectedSession) {
              text = 'Check out "' + title + '" at #io15: ' + shortURL;
            }

            url = 'https://twitter.com/intent/tweet?text=' +
                   encodeURIComponent(text);

            break;

          default:

            return;
        }

        window.open(url, 'share', winOptions);
      });

    };

    template.openSettings = function(e, detail) {
      var attr = Polymer.dom(e).rootTarget.getAttribute(ANALYTICS_LINK_ATTR);
      if (attr) {
        IOWA.Analytics.trackEvent('link', 'click', attr);
      }
      IOWA.Elements.Nav.querySelector('#signin-settings-panel').open();
    };

    template.setSelectedPageToHome = function() {
      this.selectedPage = 'home';
    };

    template.backToTop = function(e, detail) {
      e.preventDefault();

      // Audio from BenSound (http://www.bensound.com/) - Creative Commons.
      var prefix = IOWA.Util.getStaticBaseURL() + 'bower_components/elevator/demo/music/';
      var mainAudio = new Audio(prefix + 'elevator.mp3');
      var endAudio = new Audio(prefix + 'ding.mp3');

      mainAudio.play();

      IOWA.Util.smoothScroll(IOWA.Elements.Nav, 5000, function() {
        mainAudio.pause();
        endAudio.play();
      });

      IOWA.A11y.focusNavigation();
    };

    template.onCountdownTimerThreshold = function(e, detail) {
      if (detail.label === 'Ended') {
        this.countdownEnded = true;
      }
    };

    template.signIn = function(e) {
      if (e) {
        e.preventDefault();
        if (e.target.hasAttribute(ANALYTICS_LINK_ATTR)) {
          IOWA.Analytics.trackEvent(
              'link', 'click', e.target.getAttribute(ANALYTICS_LINK_ATTR));
        }
      }
      IOWA.Elements.GoogleSignIn.signIn();
    };

    template.signOut = function(e) {
      if (e) {
        e.preventDefault();
        if (e.target.hasAttribute(ANALYTICS_LINK_ATTR)) {
          IOWA.Analytics.trackEvent(
              'link', 'click', e.target.getAttribute(ANALYTICS_LINK_ATTR));
        }
      }
      IOWA.Elements.GoogleSignIn.signOut();
    };

    template.updateNotifyUser = function(e, detail) {
      // Both these functions are asynchronous and return promises. Since there's no specific
      // callback or follow-up that needs to be performed once they complete, the returned promise
      // is ignored.
      var target = Polymer.dom(e).rootTarget;
      if (target.checked) {
        // subscribePromise() handles registering a subscription with the browser's push manager
        // and toggling the notify state to true in the backend via an API call.
        IOWA.Notifications.subscribePromise().then(function() {
          IOWA.Elements.Template.dontAutoSubscribe = false;
        }).catch(function(error) {
          if (error && error.name === 'AbortError') {
            IOWA.Elements.Toast.showMessage('Please update your notification permissions', null, 'Learn how', function() {
              window.open('permissions', '_blank');
            });
          }
        });
      } else {
        // The steps to turn off notifications are broken down into two separate promises, the first
        // which unsubscribes from the browser's push manager and the second which sets the notify
        // state to false in the backend via an API call.
        // Note that we are deliberately not clearing the SW token stored in IDB, since that is tied
        // to the user's logged in state and will remain valid if notifications are re-enabled
        // later on.
        IOWA.Elements.Template.dontAutoSubscribe = true;
        IOWA.Notifications.unsubscribeFromPushManagerPromise()
          .then(IOWA.Notifications.disableNotificationsPromise)
          .catch(IOWA.Util.reportError);
      }
    };

    // Updates IOWA.Elements.GoogleSignIn.user.notify = true iff the browser supports notifications,
    // global notifications are enabled, the current browser has a push subscription,
    // and window.Notification.permission === 'granted'.
    // Updates IOWA.Elements.GoogleSignIn.user.notify = false otherwise.
    template.getNotificationState = function(e, detail) {
      // The core-overlay-open event that invokes this is called once when the overlay opens, and
      // once when it closes. We only want this code to run when the overlay opens.
      // detail is true when the setting panel is opened, and false when it's closed.
      if (!detail) {
        return;
      }

      // This sends a signal to the template that we're still calculating the proper state, and
      // that the checkbox should be disabled for the time being.
      IOWA.Elements.GoogleSignIn.user.notify = null;

      // First, check the things that can be done synchronously, before the promises.
      if (IOWA.Notifications.isSupported && window.Notification.permission === 'granted') {
        // Check to see if notifications are enabled globally, via an API call to the backend.
        IOWA.Notifications.isNotifyEnabledPromise().then(function(isGlobalNotifyEnabled) {
          if (isGlobalNotifyEnabled) {
            // If notifications are on globally, next check to see if there's an existing push
            // subscription for the current browser.
            IOWA.Notifications.isExistingSubscriptionPromise().then(function(isExistingSubscription) {
              // Set user.notify property based on whether there's an existing push manager subscription
              IOWA.Elements.GoogleSignIn.user.notify = isExistingSubscription;
            });
          } else {
            // If notifications are off globally, then always set the user.notify to false.
            IOWA.Elements.GoogleSignIn.user.notify = false;
          }
        }).catch(function() {
          // If something goes wrong while calculating the notifications state, just assume false.
          IOWA.Elements.GoogleSignIn.user.notify = false;
        });
      } else {
        // Wrap this in an async to ensure that the checked attribute is properly updated.
        this.async(function() {
          IOWA.Elements.GoogleSignIn.user.notify = false;
        });
      }
    };

    template.shiftContentLeft = function(e, detail) {
      IOWA.PageAnimation.shiftContentLeft(
          IOWA.Elements.Main.querySelector('.featured__videos'));
    };

    template.shiftContentRight = function(e, detail) {
      IOWA.PageAnimation.shiftContentRight(
          IOWA.Elements.Main.querySelector('.featured__videos'));
    };

    template.addEventListener('dom-change', updateElements);

    template.addEventListener('page-transition-done', function(e) {
      this.pageTransitionDone = true;
      IOWA.Elements.NavPaperTabs.style.pointerEvents = '';
    });

    template.addEventListener('page-transition-start', function(e) {
      this.pageTransitionDone = false;
      IOWA.Elements.NavPaperTabs.style.pointerEvents = 'none';
    });

    template._equal = function(key, val) {
      return key === val;
    };

    template._ternary = function(boolean, yes, no) {
      return boolean ? yes : no;
    };

    template._propOfArrayItem = function(array, index, prop) {
      return array[index][prop];
    };

    template._isPage = function(page, selectedPage) {
      return this._equal(page, selectedPage);
    };

    template._isSelectedSubpage = function(pageName, subpageName) {
      if (!this.pages) {
        return false;
      }
      return this.pages[pageName].selectedSubpage == subpageName;
    };

    template._computeMastheadClass = function(pages, selectedPage) {
      return pages[selectedPage].mastheadBgClass;
    };

    template._computeSignNavElementsClass = function(isPhoneSize, pages, selectedPage) {
      return isPhoneSize ? '' : pages[selectedPage].mastheadBgClass;
    };

    template._disableNotify = function(notify) {
      return notify === null;
    };

    template._addClass = function(name, prop) {
      return prop ? name : '';
    };

    template._enableTabIndex = function(val) {
      return val ? 0 : -1;
    };

    template._showSocialPosts = function(posts, atLeast) {
      return posts.length >= atLeast;
    };

    // Schedule ---

    template._hideTimezoneSelector = function(isPhoneSize, selectedPage) {
      return isPhoneSize || this.pages[selectedPage].selectedSubpage === 'agenda';
    };

    template._hideSessionFilters = function(isPhoneSize, selectedPage) {
      return !isPhoneSize || this.pages[selectedPage].selectedSubpage === 'myschedule';
    };

    template._computeActiveClassForSubpage = function(selectedSubpage, pageName, subpageName, opt_negate) {
      var isSubpage = this._isSelectedSubpage(pageName, subpageName);
      if (opt_negate) {
        isSubpage = !isSubpage;
      }
      return this._addClass('active', isSubpage);
    };

    template._computeHideSessionDetailProgress = function(user, sessions, fetching) {
      return !user || (sessions && !fetching);
    };
    // ---

    IOWA.Elements.Template = template;
    IOWA.Elements.ScrollContainer = document.querySelector(
        'paper-drawer-panel [main]');
    template.ScrollContainer = IOWA.Elements.ScrollContainer;
  }

  return {
    init: init
  };
})();
