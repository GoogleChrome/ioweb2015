var PIXI = require('pixi.js/bin/pixi.dev.js');
var animate = require('app/util/animate');

module.exports = (function() {
  'use strict';

  var dotTextures = {};

  /**
   * Creates a new guitar dot point.
   * @param {number} pid - The ID for this dot.
   * @constructor
   */
  return function Dot(pid) {
    var onActivateCallback_;

    var gridDotChild;
    var gridDotMiddle;
    var gridDotUpperWhiteTouch;
    var gridDot;
    var gridDotUpper;
    var guitarString;
    var position = new PIXI.Point(0, 0);

    buildViews();

    var self = {
      gridDotChild,
      gridDotMiddle,
      gridDotUpperWhiteTouch,
      gridDot,
      gridDotUpper,
      pid,
      setPosition,
      animateWhiteCircle,
      onActivate,
      animateMiddleDot,
      addEventListeners,
      removeEventListeners,
      getString: () => guitarString,
      setString,
      getPosition: () => position,
      tearDown
    };

    /**
     * Creates a new guitar dot point.
     * @param {Object} v - This string object.
     */
    function setString(v) {
      guitarString = v;

      if (v) {
        animateMiddleDot(1);
        animateWhiteCircle();

        addStrungEvents();
      } else {
        animateMiddleDot(0);
        animateWhiteCircle();

        addUnstrungEvents();
      }
    }

    var isListening = false;

    function addStrungEvents() {
      if (isListening) {
        gridDotUpper.interactive = false;
        gridDotMiddle.interactive = true;
      }
    }

    function addUnstrungEvents() {
      if (isListening) {
        gridDotMiddle.interactive = false;
      }
    }

    function addEventListeners() {
      if (isListening) { return; }

      isListening = true;

      gridDot.interactive = true;

      gridDotUpper.interactive = true;

      if (guitarString) {
        addStrungEvents();
      } else {
        addUnstrungEvents();
      }
    }

    function removeEventListeners() {
      if (!isListening) { return; }

      isListening = false;

      gridDot.interactive = false;
    }

    /**
     * Cleanup.
     */
    function tearDown() {
      removeEventListeners();
      onActivateCallback_ = null;
    }

    /**
     * On activate.
     * @param {function} cb - The callback for onActivate.
     */
    function onActivate(cb) {
      onActivateCallback_ = cb;
    }

    /**
     * Creates the dot graphic.
     * @param {number} size - The dot size.
     * @param {number} color - The dot number.
     */
    function createDotGraphic(size, color) {
      if (!dotTextures[size]) {
        var dot = new PIXI.Graphics();
        dot.beginFill(0xffffff, 1);
        dot.drawCircle(0, 0, size);
        dot.endFill();

        dotTextures[size] = dot.generateTexture(window.devicePixelRatio > 1.5 ? 2 : 1);
      }

      var dotContainer = new PIXI.DisplayObjectContainer();
      var s = new PIXI.Sprite(dotTextures[size]);
      s.tint = color;
      s.anchor.x = s.anchor.y = 0.5;
      dotContainer.addChild(s);
      return dotContainer;
    }

    /**
     * Build all of the dot views.
     */
    function buildViews() {
      gridDot = createDotGraphic(10, 0x0d47a0);

      gridDotUpper = createDotGraphic(25, 0x536dfd);
      gridDotUpper.alpha = 0;
      gridDotUpper.buttonMode = true;
      gridDotUpper.mouseover = function(){
        gridDotChild.tint = 0x1156B0;
      };

      gridDotUpper.mouseout = function(){
        gridDotChild.tint = 0x0d47a0;
      };

      gridDotUpperWhiteTouch = createDotGraphic(30, 0xffffff);
      gridDotUpperWhiteTouch.scale.x = gridDotUpperWhiteTouch.scale.y = 0.3;
      gridDot.addChildAt(gridDotUpperWhiteTouch, 0);

      gridDotMiddle = createDotGraphic(10, 0x536dfd);
      gridDotMiddle.alpha = 0;
      gridDotMiddle.buttonMode = true;
      gridDotMiddle.mouseover = function() {
        animate.to(gridDotMiddle.scale, 0.1, {
          x: 1.25,
          y: 1.25
        });
      };

      gridDotMiddle.mouseout = function() {
        animate.to(gridDotMiddle.scale, 0.1, {
          x: 1,
          y: 1
        });
      };

      var shadowDotUpper2 = createDotGraphic(10, 0x000000);
      shadowDotUpper2.alpha = 0.09;
      shadowDotUpper2.position.x = shadowDotUpper2.position.y = 2;

      gridDotMiddle.addChildAt(shadowDotUpper2, 0);

      gridDot.id = pid;
      gridDot.hitArea = new PIXI.Circle(0, 0, 25);
      gridDot.buttonMode = true;
      gridDot.mousedown = gridDot.touchstart = function( /* data */ ) {
        onActivateCallback_(self);
      };

      gridDotChild = gridDot.children[1];
    }

    /**
     * Animate the dot when clicked/tapped.
     * @param {number} delay - The animation delay.
     */
    function animateWhiteCircle(delay) {
      gridDotUpperWhiteTouch.alpha = 0.3;
      gridDotUpperWhiteTouch.scale.x = gridDotUpperWhiteTouch.scale.y = 0.3;

      animate.to(gridDotUpperWhiteTouch.scale, 0.5, { x: 1.2, y: 1.2, delay:delay });
      animate.to(gridDotUpperWhiteTouch, 0.5, { alpha: 0, delay:delay });
      gridDotChild.tint = 0x0d47a0;
    }

    /**
     * Creates a new guitar dot point.
     * @param {Object} v - This string object.
     */
    function animateMiddleDot(v) {
      animate.to(gridDotMiddle, 0.1, { alpha: v });
    }

    var positionTarget = { x: 0, y: 0, onUpdate: onUpdatePosition, ease: Expo.easeOut };

    /**
     * When position updates, update the position of the dot.
     */
    function onUpdatePosition() {
      gridDotUpper.position = position;
      gridDot.position = position;
      gridDotMiddle.position = position;

      if (guitarString) {
        guitarString.updateDotPosition(self);
      }
    }

    /**
     * When position updates, update the position of the dot.
     * @param {PIXI.Point} pos - The PIXI point object of the dot.
     */
    function setPosition(pos) {
      positionTarget.x = pos.x;
      positionTarget.y = pos.y;
      gridDotChild.tint = 0x0d47a0;

      animate.to(position, 0.3, positionTarget);
    }

    return self;
  };
})();
