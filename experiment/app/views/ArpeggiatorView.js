var PIXI = require('pixi.js/bin/pixi.dev.js');
var animate = require('app/util/animate');
var { vec2 } = require('p2');
var ColorGradient = require('toxiclibsjs/lib/toxi/color/ColorGradient');
var TColor = require('toxiclibsjs/lib/toxi/color/TColor');
var FloatRange = require('toxiclibsjs/lib/toxi/util/datatypes/FloatRange');
var Sliver = require('app/views/arpeggiator/Sliver');
var events = require('app/util/events');
var Track = require('app/audio/Track');
var ArpeggiatorDataModel = require('app/models/arpeggiator');
var { ArpeggiatorNoteModel } = ArpeggiatorDataModel;

module.exports = (function() {
  'use strict';

  const ARPEGGIATOR_COLORS = require('app/data/arp-colors.json');
  const THEME_NAME = ARPEGGIATOR_COLORS.selectedTheme;
  const THEME = ARPEGGIATOR_COLORS[THEME_NAME];

  const LOOP_LENGTH = 6;
  const NUMBER_OF_TRIANGLES = 6;
  const RANGE = new FloatRange(0, NUMBER_OF_TRIANGLES);

  const COLORS_A = makeSliceGradient(THEME.quadrants[0]);
  const COLORS_B = makeSliceGradient(THEME.quadrants[1]);
  const COLORS_C = makeSliceGradient(THEME.quadrants[2]);
  const COLORS_D = makeSliceGradient(THEME.quadrants[3]);
  const CENTER_COLORS = makeSliceGradient(THEME.center);

  const QUAD_MAPPING = [
    ['arp1', LOOP_LENGTH],
    ['arp2', LOOP_LENGTH],
    ['arp3', LOOP_LENGTH],
    ['arp4', LOOP_LENGTH]
  ];

  const INSTRUMENT_NAME = 'ArpeggiatorView';

  /**
   * Make the gradient for each slice of the arpeggiator.
   * @param {array} colorSet - The set of each colors for the slices.
   */
  function makeSliceGradient(colorSet) {
    const GRADIENT_A = new ColorGradient();
    GRADIENT_A.addColorAt(RANGE.getAt(0), TColor.newHex(colorSet[0]));
    GRADIENT_A.addColorAt(RANGE.getAt(0.33), TColor.newHex(colorSet[1]));
    GRADIENT_A.addColorAt(RANGE.getAt(0.66), TColor.newHex(colorSet[2]));
    GRADIENT_A.addColorAt(RANGE.getAt(1), TColor.newHex(colorSet[3]));
    return GRADIENT_A.calcGradient(0, NUMBER_OF_TRIANGLES).colors;
  }

  /**
   * Controls the Arpeggiator instrument view.
   * @param {AudioManager} audioManager - The shared audio manager.
   * @constructor
   */
  return function ArpeggiatorView(audioManager) {
    const ARPEGIATOR_TAG = audioManager.addTag(INSTRUMENT_NAME);
    const CHANNEL = audioManager.channels.create(0.45);

    var pid;
    var displayContainerCenter;
    var originalOrder;
    var renderPause = false;

    var APPLICATION_STATE = 'collapsed';

    var polygons = [];

    var currentQuadrant;
    var circleGraphic;
    var isReady = false;
    var hasInitialPosition = false;
    var currentTrack;
    var currentBeat;

    var optimalWidth;
    var optimalHeight;

    var isDragging = false;
    var isRecording = false;
    var circleRadius = 54;

    var data;
    var scratchTrack;

    /**
     * Initialize the view.
     * @param {Object} _ - Unused variable.
     * @param {number} pid_ - The ID of the view.
     * @param {PIXI.DisplayObjectContainer} displayContainerCenter_ - The center point of the view.
     */
    function init(_, pid_, displayContainerCenter_) {
      pid = pid_;
      displayContainerCenter = displayContainerCenter_;

      circleGraphic = new PIXI.Graphics();
      circleGraphic.scale.x = circleGraphic.scale.y = 0.35;

      buildSlices();

      var circle = new PIXI.Circle(0, 0, circleRadius);
      circleGraphic.beginFill(0xFFFFFF, 0.55);
      circleGraphic.pivot.x = 0;
      circleGraphic.pivot.y = 0;
      circleGraphic.drawShape(circle);
      displayContainerCenter.addChild(circleGraphic);

      isReady = true;

      scratchTrack = new Track(audioManager, {}, CHANNEL, ARPEGIATOR_TAG);

      events.addListener('BEAT', function(beatNum) {
        currentBeat = beatNum;

        if (APPLICATION_STATE === 'expand') {
          if (beatNum % LOOP_LENGTH === 0) {
            playLoop();
          }
        }
      });

      audioManager.playbackBus.onPlayback(function(note, tags) {
        if (renderPause) { return; }

        if (tags & ARPEGIATOR_TAG) {
          if ('undefined' === typeof note.beatNum) {
            if (APPLICATION_STATE === 'collapsed') {
              animateCursorToQuadrant(note.quadrant);
            }
          } else {
            var sequenceNote = note.beatNum % LOOP_LENGTH;
            for (let i = 0; i < NUMBER_OF_TRIANGLES; i++) {
              let range = NUMBER_OF_TRIANGLES - 1;
              if (i === sequenceNote) {
                originalOrder[range - i].pulse();
              }
            }
          }
        }
      });
    }

    /**
     * Load arpeggiator data.
     * @param {Model} initialData - The guitar data.
     */
    function loadData(d) {
      if (currentTrack) {
        audioManager.removeTrack(currentTrack);
      }

      data = d;

      currentTrack = audioManager.createRecordedTrack(
        data.recorded,
        CHANNEL,
        ARPEGIATOR_TAG
      );

      audioManager.addTrack(currentTrack);
    }

    /**
     * Attach event listeners.
     */
    function attachEventListeners() {
      circleGraphic.interactive = true;
      circleGraphic.buttonMode = true;
      circleGraphic.defaultCursor = '-webkit-grab';

      circleGraphic.mousedown = circleGraphic.touchstart = function() {
        isDragging = true;
        circleGraphic.defaultCursor = '-webkit-grabbing';
      };

      // set the events for when the mouse is released or a touch is released
      circleGraphic.mouseup = circleGraphic.mouseupoutside = circleGraphic.touchend = circleGraphic.touchendoutside = function() {
        isDragging = false;
        circleGraphic.defaultCursor = '-webkit-grab';
      };

      // set the callbacks for when the mouse or a touch moves
      circleGraphic.mousemove = circleGraphic.touchmove = function(data) {
        if (!isDragging) { return; }

        updateCursor(
            data.global.x - (myWidth / 2),
            data.global.y - (myHeight / 2)
        );
      };
    }

    /**
     * Remove event listeners.
     */
    function removeEventListeners() {
      circleGraphic.interactive = false;
      circleGraphic.buttonMode = false;

      circleGraphic.mousedown = circleGraphic.touchstart = null;
      circleGraphic.mouseup = circleGraphic.mouseupoutside = circleGraphic.touchend = circleGraphic.touchendoutside = null;
      circleGraphic.mousemove = circleGraphic.touchmove = null;
    }

    /**
     * Convert degrees to radians
     * @param {number} degree - Degrees to convert into radians.
     */
    function toRadians(degree) {
      return degree * (Math.PI / 180);
    }

    /**
     * Build each arpeggiator slice.
     */
    function buildSlices() {
      var nextRotation = 0;
      var data = [];

      for (let i = 0; i < NUMBER_OF_TRIANGLES; i++) {
        let { model, currentRotation } = buildSlice(i, nextRotation);
        data.push(model);
        nextRotation = currentRotation;
      }

      data = data.sort((a, b) => b[1] - a[1]);

      originalOrder = [];

      for (let j = 0; j < data.length; j++) {
        polygons.push(createSliver(data[j]));
      }

      originalOrder = originalOrder.reverse();
    }

    var wiggleRoom = 15;
    var angleBase = (360 / NUMBER_OF_TRIANGLES) - wiggleRoom;
    var angleBonus = NUMBER_OF_TRIANGLES * wiggleRoom;
    var maxDepth = (NUMBER_OF_TRIANGLES / 2);

    /**
     * Build each arpeggatior slice.
     * @param {number} i - The slice ID.
     * @param {number} currentRotation - The current rotation point.
     */
    function buildSlice(i, currentRotation) {
      var depth = Math.abs(maxDepth - i);
      var nextDepth = Math.abs(maxDepth - ((i >= (NUMBER_OF_TRIANGLES - 1)) ? 0 : (i + 1)));

      var randomWiggle = ~~(Math.random() * wiggleRoom * 2);

      if (randomWiggle > angleBonus) {
        randomWiggle = angleBonus;
      }

      var angle = angleBase + randomWiggle;
      angleBonus -= randomWiggle;

      if (i === NUMBER_OF_TRIANGLES - 1) {
        angle += angleBonus;
      }

      var angleRads = toRadians(angle);
      var rotationRads = toRadians(currentRotation);
      var polygon = makeTriangle(angleRads, rotationRads);

      var hasLeftShadow = false;
      var hasRightShadow = false;

      if (depth === maxDepth) {
        hasLeftShadow = true;
        hasRightShadow = true;
      } else if (depth === 0) {
        /* jshint noempty: false */
        // no-op
      } else if (nextDepth > depth) {
        hasRightShadow = true;
      } else {
        hasLeftShadow = true;
      }

      var colorSet = [
        COLORS_A.pop(),
        COLORS_B.pop(),
        COLORS_C.pop(),
        COLORS_D.pop(),
        CENTER_COLORS.pop()
      ];

      return {
        currentRotation: currentRotation + angle,
        model: [polygon, depth, colorSet, hasLeftShadow, hasRightShadow, i]
      };
    }

    /**
     * Build each arpeggatior slice.
     * @param {array} data - data about each arpeggiator slice.
     */
    function createSliver(data) {
      var container = new PIXI.DisplayObjectContainer();

      var sliver = new Sliver(container, data[0], data[1], data[2], data[3], data[4], 0);
      sliver.render();
      displayContainerCenter.addChild(container);

      var originalIndex = data[5];
      originalOrder[originalIndex] = sliver;

      return sliver;
    }

    /**
     * Make the arpeggiator triangles.
     * @param {number} radians - Radians.
     * @param {number} rotation - The current rotation point.
     */
    function makeTriangle(radians, rotation) {
      var maxLength = Math.max(window.innerHeight, window.innerWidth);
      var bottomVec = vec2.fromValues(0, maxLength);
      vec2.rotate(bottomVec, bottomVec, rotation);

      var topVec = vec2.create();
      vec2.rotate(topVec, bottomVec, radians);

      var a = new PIXI.Point(0, 0);
      var b = new PIXI.Point(bottomVec[0], bottomVec[1]);
      var c = new PIXI.Point(topVec[0], topVec[1]);

      return new PIXI.Polygon(a, b, c);
    }

    /**
     * Do things when animation is collapsed.
     */
    function animationCollapsed() {
      APPLICATION_STATE = 'collapsed';

      animate.to(circleGraphic.scale, 0.5, { x: 0.35, y: 0.35, ease: Back.easeInOut });

      audioManager.addTrack(currentTrack);
      removeEventListeners();
    }

    /**
     * Do things when animation is expanded.
     */
    function animationExpanded() {
      APPLICATION_STATE = 'expand';

      animate.to(circleGraphic.scale, 0.5, { x: 1, y: 1, ease: Back.easeInOut, delay: 0.45 });

      audioManager.removeTrack(currentTrack);
      attachEventListeners();
    }

    /**
     * Start arpeggiator recording.
     */
    function startRecording() {
      isRecording = true;
      data.recorded = [];
    }

    /**
     * Stop arpeggiator recording.
     */
    function stopRecording() {
      isRecording = false;

      currentTrack = audioManager.createRecordedTrack(
        data.recorded,
        CHANNEL,
        ARPEGIATOR_TAG
      );
    }

    /**
     * Play the arpeggiator loop and record if in recording state.
     */
    function playLoop() {

      if (!isDragging) {
        return;
      }

      var mapping = QUAD_MAPPING[currentQuadrant];

      var note = new ArpeggiatorNoteModel({
        beat: currentBeat,
        quadrant: currentQuadrant,
        sound: audioManager.getSoundLoop(QUAD_MAPPING[currentQuadrant][0]).guid
      });

      scratchTrack.playSound(mapping[0], audioManager.audioContext.currentTime, null, null, currentBeat, note);

      if (isRecording) {
        data.recorded.push(note);
      }
    }

    /**
     * Update the arpeggiator quadrant on move.
     * @param {number} newQuadrant - The new Quadrant entered.
     */
    function updateQuadrant(newQuadrant) {
      if (currentQuadrant === newQuadrant) { return; }

      currentQuadrant = newQuadrant;
    }

    var cursorX = 0;
    var cursorY = 0;
    var targetX = 0;
    var targetY = 0;

    /**
     * Update the arpeggiator cursor.
     * @param {number} x - The x position of the cursor.
     * @param {number} y - The y position of the cursor.
     */
    function updateCursor(x, y) {
      cursorX = x;
      cursorY = y;

      for (let i = 0; i < NUMBER_OF_TRIANGLES; i++) {
        polygons[i].updateCenterPoint(
            x,
            y
        );
      }
      circleGraphic.position.x = x;
      circleGraphic.position.y = y;

      var q = quadrantForPos(x, y);
      updateQuadrant(q);
    }

    /**
     * Animate the arpeggiator cursor to a quadrant.
     * @param {number} q - The quadrant to animate to.
     */
    function animateCursorToQuadrant(q) {
      var [newX, newY] = positionForQuadrant(q);
      targetX = newX;
      targetY = newY;
    }

    /**
     * Determines which sound is playing in which quadrant.
     * @param {number} x - Quadrant x pos.
     * @param {number} y - Quadrant y pos.
     */
    function quadrantForPos(x, y) {
      if (x <= 0 && y <= 0) {
        return 0;
      } else if (x <= 0 && y > 0) {
        return 1;
      } else if (x > 0 && y <= 0) {
        return 2;
      } else {
        return 3;
      }
    }

    /**
     * Determine the quadrant size based on the circle radius.
     * @param {number} quadrant - Quadrant.
     */
    function positionForQuadrant(quadrant) {
      var oWidth = optimalWidth - (circleRadius * 2);
      var oHeight = optimalHeight - (circleRadius * 2);

      if (quadrant === 0) {
        return [oWidth / -2, oHeight / -2];
      } else if (quadrant === 1) {
        return [oWidth / -2, oHeight / 2];
      } else if (quadrant === 2) {
        return [oWidth / 2, oHeight / -2];
      } else if (quadrant === 3) {
        return [oWidth / 2, oHeight / 2];
      }
    }

    /**
     * On resize, resize the arpeggiator view.
     * @param {number} w - View width.
     * @param {number} h - View height.
     * @param {number} _optimalWidth - Optimal view width.
     * @param {number} _optimalHeight - Optimal view height.
     */
    var myWidth;
    var myHeight;
    function resize(w, h, _optimalWidth, _optimalHeight) {
      myWidth = w;
      myHeight = h;
      optimalWidth = _optimalWidth;
      optimalHeight = _optimalHeight;

      if (isReady) {
        if ((APPLICATION_STATE !== 'expand') && !hasInitialPosition) {
          updateCursor(0, 0);
          hasInitialPosition = true;
        }
      }
    }

    /**
     * Render on RAF.
     * @param {number} delta - The delta.
     */
    function render(delta) {
      if (renderPause) { return; }

      if (APPLICATION_STATE === 'expand') {
        renderExpanded(delta);
      } else {
        renderCollapsed(delta);
      }
    }

    /**
     * Render the expanded view.
     */
    function renderExpanded() {
    }

    /**
     * Render the collapsed view.
     */
    function renderCollapsed() {
      if ((targetX === cursorX) && (targetY === cursorY)) { return; }

      var newX = cursorX + ((targetX - cursorX) * 0.07);
      var newY = cursorY + ((targetY - cursorY) * 0.07);

      var deltaX = Math.abs(newX - cursorX);
      var deltaY = Math.abs(newY - cursorY);

      if ((deltaX >= 0.1) && (deltaY >= 0.1)) {
        updateCursor(newX, newY);
      } else {
        targetX = cursorX;
        targetY = cursorY;
      }
    }

    /**
     * Pause the arpeggiator.
     */
    function disable() {
      renderPause = true;
    }

    /**
     * Resume the arpeggiator.
     */
    function enable() {
      renderPause = false;
    }

    return {
      init,
      animationCollapsed,
      animationExpanded,
      enable,
      disable,
      render,
      resize,
      startRecording,
      stopRecording,
      loadData,
      name: INSTRUMENT_NAME,
      backgroundColor: THEME.center[0],
      dataModel: ArpeggiatorDataModel,
      getData: () => data,
      getChannel: () => CHANNEL
    };
  };
})();
