var PIXI = require('pixi.js/bin/pixi.dev.js');
var animate = require('app/util/animate');

module.exports = (function() {
  'use strict';

  const BLACK = 0x000000;
  const WHITE = 0xFFFFFF;
  const BOUNDS_PADDING = 15;
  const SHADOW_SCALE = 0.85;

  /**
   * Creates a new parallelogram.
   * @param {string} color - The color for this parallelogram.
   * @param {string} hoverColor - The hover color for this parallelogram.
   * @param {string} note - The note to be played by this parallelogram.
   * @param {number} keyID - The Key ID for this parallelogram.
   * @param {number} pid - The unique id for this parallelogram.
   * @param {AudioManager} audioManager - The audioManager context.
   * @constructor
   */
  return function Parallelogram(color, hoverColor, note, keyID, pid, audioManager) {
    var notePlaying;
    var startTime;
    var endTime;

    var container = new PIXI.DisplayObjectContainer();
    var parallelogram = new PIXI.Graphics();
    var shadow = new PIXI.Graphics();
    var circle = new PIXI.Graphics();
    var circleMask = new PIXI.Graphics();

    circle.mask = circleMask;
    circle.scale = new PIXI.Point(0, 0);

    var blurFilter = new PIXI.BlurFilter();
    shadow.boundsPadding = BOUNDS_PADDING;
    shadow.filters = [blurFilter];
    shadow.scale.x = SHADOW_SCALE;
    shadow.scale.y = SHADOW_SCALE;
    shadow.position.x = 4;
    shadow.position.y = 6;

    container.addChild(shadow);
    container.addChild(parallelogram);
    container.addChild(circle);
    container.addChild(circleMask);

    var self = {
      container,
      onActivate,
      onDeactivate,
      pid,
      popUp,
      popDown,
      note,
      startTime,
      addEventListeners,
      removeEventListeners,
      setSize,
      setPosition,
      tearDown
    };

    var onActivateCallback;

    function setPosition(x, y, rot) {
      animate.to(container.position, 0.3, { x, y, ease: Expo.easeOut });
      animate.to(container, 0.3, { rotation: rot, ease: Expo.easeOut });
    }

    function setSize(shapeWidth, shapeHeight, shapeSkew) {
      var shape = new PIXI.Polygon([
        new PIXI.Point(0,0),
        new PIXI.Point(shapeWidth,0),
        new PIXI.Point(shapeWidth - shapeSkew,shapeHeight),
        new PIXI.Point(-shapeSkew,shapeHeight)
      ]);

      var circleRadius = 300;
      container.hitArea = shape;

      circleMask.clear();
      circleMask.beginFill(BLACK);
      circleMask.drawShape(shape);
      circleMask.endFill();

      circle.clear();
      circle.beginFill(BLACK, 0.1);
      circle.drawCircle(0, 0, circleRadius);
      circle.endFill();

      circle.position.x = shapeWidth/2 - shapeSkew/2;
      circle.position.y = shapeHeight/2;

      parallelogram.clear();
      parallelogram.beginFill(WHITE);
      parallelogram.drawShape(shape);
      parallelogram.endFill();
      parallelogram.tint = color;

      shadow.clear();
      shadow.beginFill(BLACK, 0.2);
      shadow.drawShape(shape);
      shadow.endFill();

      container.pivot.x = shapeWidth/2;
      container.pivot.y = shapeHeight/2;
    }

    /**
     * When activated, pass the callback to the function.
     * @param {function} cb - The callback to run.
     */
    function onActivate(cb) {
      onActivateCallback = cb;
    }

    var onDeactivateCallback;

    /**
     * When deactivated, pass the callback to the function.
     * @param {function} cb - The callback to run.
     */
    function onDeactivate(cb) {
      onDeactivateCallback = cb;
    }

    /**
     * Add event listeners.
     */
    function addEventListeners() {
      container.interactive = true;
      container.buttonMode = true;
      parallelogram.interactive = true;

      container.mousedown = container.mousedownoutside = container.touchstart = container.touchstartoutside = function(data) {
        var point = data.getLocalPosition(container);
        onActivateCallback(self, point.x, point.y);
      };

      container.mouseup = container.mouseupoutside = container.touchend = container.touchendoutside = function() {
        onDeactivateCallback(self);
      };

      parallelogram.mouseover = function(){
        parallelogram.tint = hoverColor;
      };

      parallelogram.mouseout = function(){
        parallelogram.tint = color;
      };

      document.addEventListener('keydown', onParallelogramsKeyDown);
      document.addEventListener('keyup', onParallelogramsKeyUp);

    }

    /**
     * Remove event listeners.
     */
    function removeEventListeners() {
      container.interactive = false;
      container.buttonMode = false;
      parallelogram.interactive = false;

      container.mousedown = container.mousedownoutside = container.touchstart = container.touchstartoutside = null;
      container.mouseup = container.mouseupoutside = container.touchend = container.touchendoutside = null;

      document.removeEventListener('keydown', onParallelogramsKeyDown);
      document.removeEventListener('keyup', onParallelogramsKeyUp);
    }

    /**
     * Clean up.
     */
    function tearDown() {
      removeEventListeners();
      onActivateCallback = null;
      onDeactivateCallback = null;
    }

    var scale = {
      up: {
        container: {
          x: 1.1,
          y: 1.1
        },
        shadow: {
          x: 1.03,
          y: 1.03
        },
        circle: {
          x: 1,
          y: 1
        },
        circleAlpha: {
          alpha: 0
        }
      }
    };

    const NUMBER_KEY_RANGE = [49, 57];

    /**
     * Keydown handler for parallelogram.
     * @param {event} evt - The keydown event.
     */
    function onParallelogramsKeyDown(evt) {
      if ((evt.keyCode >= NUMBER_KEY_RANGE[0]) && (evt.keyCode <= NUMBER_KEY_RANGE[1])) {
        activateKey(evt.keyCode - NUMBER_KEY_RANGE[0]);
      }
    }

    /**
     * Keyup handler for parallelogram.
     * @param {event} evt - The keyup event.
     */
    function onParallelogramsKeyUp(evt) {
      if ((evt.keyCode >= NUMBER_KEY_RANGE[0]) && (evt.keyCode <= NUMBER_KEY_RANGE[1])) {
        deactivateKey(evt.keyCode - NUMBER_KEY_RANGE[0]);
      }
    }

    /**
     * Activate the corresponding key.
     * @param {number} key - The pid for the parallelogram.
     */
    function activateKey(key) {
      if (key === self.pid) {
        onActivateCallback(self);
      }
    }

    /**
     * Deactivate the corresponding key.
     * @param {number} key - The pid for the parallelogram.
     */
    function deactivateKey(key) {
      if (key === self.pid) {
        onDeactivateCallback(self);
      }
    }

    /**
     * When parallelogram is pushed/tapped, pop it up and start the note.
     * @param {number} x - The x location of the tap event.
     * @param {number} y - The y location of the tap event.
     */
    function popUp(x, y, currentSound) {
      container.parent.setChildIndex(container, container.parent.children.length-1);

      if (!notePlaying) {
        animate.to(container.scale, 0.25, scale.up.container);
        animate.to(shadow.scale, 0.25, scale.up.shadow);
        animate.to(circle.scale, 0.7, scale.up.circle);

        circle.alpha = 1;
        circle.scale.x = circle.scale.y = 0;
        animate.to(circle, 0.75, scale.up.circleAlpha);

        if (currentSound) {
          notePlaying = currentSound;
        } else {
          circle.position.x = x;
          circle.position.y = y;
          notePlaying = audioManager.playSoundImmediately(note);
        }
      }

      startTime = audioManager.audioContext.currentTime;

      return startTime;
    }

    /**
     * When parallelogram is released, pop it down and stop the note.
     * @param {number} start - The start time of the note
     */
    function popDown(fadeDuration) {
      if (notePlaying) {
        var target = { volume: 1 };
        animate.to(target, fadeDuration - 0.1, {
          volume: 0,
          onUpdate: function(myNote) {
            if (myNote) {
              myNote.gain.value = target.volume;
            }
          }.bind(null, notePlaying)
        });

        notePlaying = null;
      }

      animate.to(container.scale, 0.25, {
        x: 1,
        y: 1
      });

      animate.to(shadow.scale, 0.25, {
        x: SHADOW_SCALE,
        y: SHADOW_SCALE
      });

      endTime = audioManager.audioContext.currentTime + fadeDuration;
      return endTime - startTime;

    }

    return self;

  };

})();
