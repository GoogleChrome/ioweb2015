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
  * @fileOverview Animations for page transitions.
  */

IOWA.PageAnimation = (function() {

  var CONTENT_SLIDE_DURATION = 300;
  var CONTENT_SLIDE_DELAY = 200;
  var CONTENT_SLIDE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
  var CONTENT_SLIDE_LENGTH = '100px';

  var CONTENT_SLIDE_OPTIONS = {
    duration: CONTENT_SLIDE_DURATION,
    easing: CONTENT_SLIDE_EASING,
    fill: 'forwards'
  };

  var CONTENT_SLIDE_DELAY_OPTIONS = {
    duration: CONTENT_SLIDE_DURATION,
    delay: CONTENT_SLIDE_DELAY,
    easing: CONTENT_SLIDE_EASING,
    fill: 'forwards'
  };

  /**
   * Fades element out.
   * @param {Element} el DOM element.
   * @param {Object} option Options for the transition, e.g. duration.
   * @return {Animation} Ripple animation definition.
   */
  function elementFadeOut(el, options) {
    options.fill = 'forwards'; // Always keep the state at the end of animation.
    return new KeyframeEffect(el, [{opacity: 1}, {opacity: 0}], options);
  }

  /**
   * Fades element in.
   * @param {Element} el DOM element.
   * @param {Object} option Options for the transition, e.g. duration.
   * @return {Animation} Ripple animation definition.
   */
  function elementFadeIn(el, options) {
    options.fill = 'forwards'; // Always keep the state at the end of animation.
    return new KeyframeEffect(el, [{opacity: 0}, {opacity: 1}], options);
  }

  /**
   * Returns an animation to slide out and fade out a section of a page.
   * Used together with sectionSlideIn for subpage transitions.
   * @param {Element} section Section to slide out.
   * @return {Animation} Page animation definition.
   */
  function sectionSlideOut(section) {
    var main = section.querySelector('.slide-up');
    var mainDelayed = section.querySelector('.slide-up-delay');
    var start = {
      transform: 'translate(0, 0)',
      opacity: 1
    };
    var end = {
      transform: 'translate(0, ' + CONTENT_SLIDE_LENGTH + ')',
      opacity: 0
    };
    return new GroupEffect([
      new KeyframeEffect(main, [start, end], CONTENT_SLIDE_DELAY_OPTIONS),
      new KeyframeEffect(mainDelayed, [start, end], CONTENT_SLIDE_OPTIONS),
    ]);
  }

  /**
   * Returns an animation to slide up and fade in a section of a page.
   * Used together with sectionSlideOut for subpage transitions.
   * @param {Element} section Section to slide in.
   * @return {Animation} Page animation definition.
   */
  function sectionSlideIn(section) {
    var main = section.querySelector('.slide-up');
    var mainDelayed = section.querySelector('.slide-up-delay');
    var start = {
      transform: 'translate(0, ' + CONTENT_SLIDE_LENGTH + ')',
      opacity: 0
    };
    var end = {
      transform: 'translate(0, 0)',
      opacity: 1
    };
    return new GroupEffect([
      new KeyframeEffect(main, [start, end], CONTENT_SLIDE_OPTIONS),
      new KeyframeEffect(mainDelayed, [start, end], CONTENT_SLIDE_DELAY_OPTIONS),
    ]);
  }

  /**
   * Returns an animation to slide and fade out the main content of the page.
   * Used together with contentSlideIn for page transitions.
   * @return {Animation} Page animation definition.
   */
  function contentSlideOut() {
    return new GroupEffect([
      sectionSlideOut(IOWA.Elements.Main),
      elementFadeOut(IOWA.Elements.MastheadMeta, CONTENT_SLIDE_OPTIONS),
      elementFadeOut(IOWA.Elements.MastheadMetaCorner, CONTENT_SLIDE_OPTIONS),
      elementFadeOut(IOWA.Elements.Footer, {duration: 0}) // Hide instantly.
    ]);
  }

  /**
   * Returns an animation to slide up and fade in the main content of the page.
   * Used together with contentSlideOut for page transitions.
   * TODO: Should be possible by reversing slideout animation.
   * @return {Animation} Page animation definition.
   */
  function contentSlideIn() {
    return new GroupEffect([
      sectionSlideIn(IOWA.Elements.Main),
      elementFadeIn(IOWA.Elements.MastheadMetaCorner, CONTENT_SLIDE_OPTIONS),
      elementFadeIn(IOWA.Elements.Footer, CONTENT_SLIDE_DELAY_OPTIONS)
    ]);
  }

  /**
   * Returns an animation to slide the top nav out of the screen.
   * @return {Animation} Page animation definition.
   */
  function navSlideOut() {
    return new KeyframeEffect(IOWA.Elements.Nav, [
       {transform: 'translateY(0)'},
       {transform: 'translateY(-100%)'}
    ], CONTENT_SLIDE_OPTIONS);
  }

  /**
   * Returns an animation to slide the top nav into the screen.
   * @return {Animation} Page animation definition.
   */
  function navSlideIn() {
    return new KeyframeEffect(IOWA.Elements.Nav, [
       {transform: 'translateY(-100%)'},
       {transform: 'translateY(0)'}
    ], CONTENT_SLIDE_OPTIONS);
  }

  /**
   * Returns an animation to play a color ink ripple.
   * @param {Element} ripple Ripple DOM element.
   * @param {number} x X coordinate of the center of the ripple.
   * @param {number} y Y coordinate of the center of the ripple.
   * @param {number} duration How long is the animation.
   * @param {string} duration color Ripple color.
   * @param {boolean} isFadeRipple If true, play a temporary glimpse ripple.
   *     If false, play a regular opaque color ripple.
   * @return {Animation} Ripple animation definition.
   */
  function rippleEffect(ripple, x, y, duration, color, isFadeRipple) {
    var translate = 'translate3d(' + x + 'px,' + y + 'px, 0)';
    var parentRect = ripple.parentNode.getBoundingClientRect();
    var scaleTo = Math.ceil((Math.max(
        parentRect.width, parentRect.height) / ripple.offsetHeight) * 2);

    var start = {
      transform: translate + ' scale(0)',
      opacity: isFadeRipple ? 0.5 : 1,
      backgroundColor: color
    };
    var end = {
      transform: translate + ' scale(' + scaleTo + ')',
      opacity: isFadeRipple ? 0 : 1,
      backgroundColor: color
    };
    var animation = new KeyframeEffect(ripple, [start, end], {
      duration: duration,
      fill: 'forwards'  // Makes ripple keep its state at the end of animation
    });
    return animation;
  }

  /**
   * An animation for the first page render. It slides the content in
   * and fades in the masthead meta.
   * @return {Animation} Ripple animation definition.
   */
  function pageFirstRender(section) {
    if (section) {
      var sections = document.querySelectorAll('.subpage__content');
      Array.prototype.forEach.call(sections, function(section) {
        section.style.display = 'none';
      });
      section.style.display = '';
    }
    var slideInAnimation = section ? sectionSlideIn(section) : contentSlideIn();
    return new GroupEffect([
      slideInAnimation,
      elementFadeIn(IOWA.Elements.MastheadMeta, CONTENT_SLIDE_OPTIONS)
    ], CONTENT_SLIDE_OPTIONS);
  }

  /**
   * An animation for the page slide in transition. It slides the content in
   * and fades in the masthead meta and IO logo.
   * @return {Animation} Ripple animation definition.
   */
  function pageSlideIn() {
    var animationGroup =  new GroupEffect([
      contentSlideIn(),
      elementFadeIn(IOWA.Elements.MastheadMeta, CONTENT_SLIDE_OPTIONS),
    ], CONTENT_SLIDE_OPTIONS);
    return animationGroup;
  }

  /**
   * Returns an animation to play a hero card takeover animation. The card
   *     plays a ripple on itself and grows to cover the masthead.
   * @param {Element} card Card DOM element.
   * @param {number} x X coordinate of the center of the ripple.
   * @param {number} x Y coordinate of the center of the ripple.
   * @param {number} duration Duration of the animation.
   * @param {string} color Color of the ripple.
   * @return {Animation} Ripple animation definition.
   */
  function pageCardTakeoverOut(card, x, y, duration, color) {
    var ripple = card.querySelector('.ripple__content');
    var rippleRect = IOWA.Util.resizeRipple(ripple);
    ripple.style.backgroundColor = color;
    ripple.parentNode.style.zIndex = 2;

    var mastheadRect = IOWA.Elements.Masthead.getBoundingClientRect();
    var scaleX = mastheadRect.width / rippleRect.width;
    var scaleY = mastheadRect.height / rippleRect.height;
    var scale = 'scale(' + scaleX + ', ' + scaleY + ')';
    var translate = 'translate3d(' + (-rippleRect.left) + 'px,' +
        (-rippleRect.top)  + 'px, 0)';

    card.style.transformOrigin = '0 0';
    card.style.webkitTransformOrigin = '0 0';
    var cardTransition = new KeyframeEffect(card, [
      {transform: 'translate3d(0, 0, 0) scale(1)'},
      {transform: [translate, scale].join(' ')}
    ], {
      duration: duration,
      fill: 'forwards'
    });

    var mainDelayed = IOWA.Elements.Main.querySelector('.slide-up-delay');

    // First run the hero card takeover...
    var animationGroup = new GroupEffect([
      rippleEffect(ripple, x - rippleRect.left, y - rippleRect.top, duration),
      cardTransition,
      navSlideOut(),
      elementFadeOut(mainDelayed, CONTENT_SLIDE_OPTIONS)
    ]);

    // ...then hide the content under the hero unit.
    return new SequenceEffect([
      animationGroup,
      elementFadeOut(IOWA.Elements.Ripple, {duration: 0}), // Hide instantly.
      elementFadeOut(IOWA.Elements.Footer, {duration: 0}),  // Same.
      elementFadeOut(IOWA.Elements.MastheadMeta, {duration: 0}) // Same.
    ]);
  }

  /**
   * An animation for the page hero card transition. It slides the page
   * and the top navigation in.
   * @return {Animation} Ripple animation definition.
   */
  function pageCardTakeoverIn() {
    return new GroupEffect([
      pageSlideIn(),
      navSlideIn()
    ], CONTENT_SLIDE_OPTIONS);
  }

  /**
   * Slides (transforms) container to the left.
   * @param {Element} container The container to move.
   */
  function shiftContentLeft(container) {
    var transform = container.style.transform;

    // "translate3d(100px, 0px, 0px)" -> 100
    var lastX = transform ? parseInt(transform.split('(')[1].split(',')[0]) : 0;

    var cardRect = container.querySelector('.item:last-of-type').getBoundingClientRect();
    var cardWidth = cardRect.width;

    var newX = lastX + cardWidth;
    if (newX < cardWidth) {
      container.style.transform = 'translate3d(' + newX + 'px, 0, 0)';
    }
  }

  /**
   * Slides (transforms) container to the right.
   * @param {Element} container The container to move.
   */
  function shiftContentRight(container) {
    var transform = container.style.transform;

    // "translate3d(100px, 0px, 0px)" -> 100
    var lastX = transform ? parseInt(transform.split('(')[1].split(',')[0]) : 0;

    var containerWidth = container.getBoundingClientRect().width;
    var cardRect = container.querySelector('.item:last-of-type').getBoundingClientRect();

    var lastCardRight = cardRect.right;
    var cardWidth = cardRect.width;

    var newX = lastX - cardWidth;

    if (lastCardRight > containerWidth) {
      container.style.transform = 'translate3d(' + newX + 'px, 0, 0)';
    }
  }

  /**
   * Plays an animation, animation group or animation sequence. Calls
   *     a callback when it finishes, if one was assigned.
   * @param {AnimationNode} animation Animation or AnimationGroup or
   *     AnimationSequence.
   * @param {function()=} opt_callback Callback to execute at the end of the
   *     animation.
   */
  function play(animation, callback) {
    var player = document.timeline.play(animation);
    if (callback) {
      player.onfinish = callback;
    }
  }

  /**
   * Slides in the content of the page.
   */
  function playPageSlideIn() {
    return new Promise(function(resolve, reject) {
      // Wait 1 rAF for DOM to settle.
      // IOWA.Elements.Template.async(function() {
        // Hide the masthead ripple before proceeding with page transition.
        play(elementFadeOut(IOWA.Elements.Ripple, {duration: 0}));
        play(pageSlideIn(), resolve);
      // });

    });
  }

  /**
   * Slides out the content of the page.
   */
  function playPageSlideOut() {
    return new Promise(function(resolve, reject) {
      // Wait 1rAF for smooth animation.
      // IOWA.Elements.Template.async(function() {
        play(contentSlideOut(), resolve);
      // });
    });
  }

  /**
   * Slides out the content of the section.
   */
  function playSectionSlideOut(section) {
    return new Promise(function(resolve, reject) {
      play(new GroupEffect([
        sectionSlideOut(section),
        elementFadeOut(IOWA.Elements.Footer, {duration: 400})
      ]), resolve);
    });
  }

  /**
   * Slides in the content of the section.
   */
  function playSectionSlideIn(section) {
    return new Promise(function(resolve, reject) {
      play(new GroupEffect([
        sectionSlideIn(section),
        elementFadeIn(IOWA.Elements.Footer, {duration: 400})
      ]), resolve);
    });
  }

  /**
   * Runs the ripple across the masthead, while sliding out the content.
   */
  function playMastheadRippleTransition(startPage, endPage, e, sourceEl) {
    return new Promise(function(resolve, reject) {
      var t = IOWA.Elements.Template;
      var startBgClass = t.pages[startPage].mastheadBgClass;
      var endBgClass = t.pages[endPage].mastheadBgClass;

      var isFadeRipple = startBgClass === endBgClass;
      var mastheadColor = t.rippleColors[startBgClass];
      var rippleColor = isFadeRipple ? '#fff' : t.rippleColors[endBgClass];

      var x = e.touches ? e.touches[0].pageX : e.pageX;
      var y = e.touches ? e.touches[0].pageY : e.pageY;
      var duration = 300;//isFadeRipple ? 300 : 600;
      var rippleAnim = rippleEffect(
            IOWA.Elements.Ripple, x, y, duration,
            rippleColor, isFadeRipple);
      var animation = new GroupEffect([rippleAnim, contentSlideOut()]);
      play(animation, resolve);
    });
  }

  /**
   * Expands the card to cover masthead (hero transition),
   * while sliding out the content.
   */
  function playHeroTransitionStart(startPage, endPage, e, sourceEl) {
    var touchData = (e.type == 'touchstart') ? e.touches[0] : e;
    return new Promise(function(resolve, reject) {
      var t = IOWA.Elements.Template;
      var endBgClass = t.pages[endPage].mastheadBgClass;
      var rippleColor = t.rippleColors[endBgClass];

      // TODO: This may need some perf tweaking for FF.
      var card = null;
      var currentEl = sourceEl;
      while (!card) {
        currentEl = currentEl.parentNode;
        if (currentEl.classList.contains('card__container')) {
          card = currentEl;
        }
      }
      play(pageCardTakeoverOut(
          card, touchData.pageX, touchData.pageY, 300, rippleColor), resolve);
    });
  }

  /**
   * Slides in the content, the navbar and the logo.
   */
  function playHeroTransitionEnd() {
    return new Promise(function(resolve, reject) {
      // Wait 1 rAF for DOM to settle.
      IOWA.Elements.Template.async(function() {
        play(
          pageCardTakeoverIn(), resolve);
      });
    });
  }

  return {
    pageFirstRender: pageFirstRender,
    play: play,
    playPageSlideOut: playPageSlideOut,
    playPageSlideIn: playPageSlideIn,
    playSectionSlideOut: playSectionSlideOut,
    playSectionSlideIn: playSectionSlideIn,
    playMastheadRippleTransition: playMastheadRippleTransition,
    playHeroTransitionStart: playHeroTransitionStart,
    playHeroTransitionEnd: playHeroTransitionEnd,
    shiftContentLeft: shiftContentLeft,
    shiftContentRight: shiftContentRight
  };

})();
