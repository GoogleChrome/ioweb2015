var Hexagon = require('app/views/hexagon/Hexagon');
var Cube = require('app/views/hexagon/Cube');
var { vec2 } = require('p2');
var events = require('app/util/events');
var HexagonDataModel = require('app/models/hexagon');
var { HexagonNoteModel } = HexagonDataModel;

module.exports = (function() {
  'use strict';

  const VIEW_NAME = 'HexagonView';
  const SIDES = 6;

  /**
   * Map repeating sets of 5 columns to one of 5 sounds.
   * @param {Cube} cubePos - The cube position.
   * @return {string}
   */
  function soundForPos(cubePos) {
    var [, col] = cubePos.getRowColumn();
    var idx = Math.abs((col - 2) % 5);
    return `hexagon${5 - idx}`;
  }

  /**
   * Controls the Hexagon instrument.
   * @param {AudioManager} audioManager - The shared audio manager.
   * @constructor
   */
  return function HexagonView(audioManager) {
    var displayContainerCenter;
    var pid;

    var renderPause = false;
    var currentTrack;

    const HEXAGON_TAG = audioManager.addTag(VIEW_NAME);
    const CHANNEL = audioManager.channels.create(0.65);

    var isRecording = false;

    var data;

    var currentState = 'collapsed';

    var hexagons = [];
    var currentBeat;

    var radius;

    var startVec;
    var endVec;

    var sideLength;
    var halfSideLength;
    var smallRadius;

    var isListening = false;

    /**
     * Initialize the view.
     * @param {Object} _ - Unused variable.
     * @param {number} pid_ - The ID of the view.
     * @param {PIXI.DisplayObjectContainer} displayContainerCenter_ - The center point of the view.
     */
    function init(_, pid_, displayContainerCenter_) {
      pid = pid_;
      displayContainerCenter = displayContainerCenter_;

      events.addListener('BEAT', function(beatNum) {
        currentBeat = beatNum;
      });

      audioManager.playbackBus.onPlayback(function(note, tags) {
        if (renderPause) { return; }

        if (tags & HEXAGON_TAG) {
          activateHexagon(note.cube, true);
        }
      });
    }

    /**
     * Resize all the hexagons.
     * @param {number} _radius - The new hexagon radius.
     */
    function updateHexagonSizes(_radius) {
      radius = _radius;

      startVec = vec2.fromValues(radius, 0);
      endVec = vec2.create();
      vec2.rotate(endVec, startVec, Math.PI * 2 / SIDES);

      sideLength = vec2.distance(startVec, endVec);
      halfSideLength = sideLength / 2;
      smallRadius = Math.sqrt((radius * radius) - (halfSideLength * halfSideLength));
    }

    /**
     * Initialize view data.
     * @param {Model} d - The new data model.
     */
    function loadData(d) {
      if (currentTrack) {
        audioManager.removeTrack(currentTrack);
      }

      data = d;

      currentTrack = audioManager.createRecordedTrack(
        data.recorded,
        CHANNEL,
        HEXAGON_TAG
      );

      audioManager.addTrack(currentTrack);
    }

    /**
     * Activate a single hexagon which ripples.
     * @param {Cube} cubePos - Which cube to activate.
     * @param {boolean=false} dontRecord - If we should skip recording. Used for audio reactive.
     */
    function activateHexagon(cubePos, dontRecord) {
      if (!dontRecord) {
        audioManager.playSoundImmediately(soundForPos(cubePos), CHANNEL);

        var notePlay = new HexagonNoteModel({
          beat: currentBeat,
          sound: audioManager.getSound(soundForPos(cubePos)).guid,
          cube: cubePos
        });

        data.recorded.push(notePlay);
      }

      var expandingRadius = 0;

      /* jshint curly: false */
      while (activateRing(cubePos, expandingRadius++, expandingRadius * 0.1));
    }

    /**
     * Activate (animated ripple) a hexagon.
     * @param {Cube} cubePos - The cube position.
     * @param {number} ringRadius - The current radius.
     * @param {number} delay - When to animate.
     * @return {boolean}
     */
    function activateRing(cubePos, ringRadius, delay) {
      var drawable = false;

      cubePos.getRing(ringRadius).forEach(function(p) {
        var wiggle = 0.035 * Math.random();
        if (p.hexagon) {
          p.hexagon.activate(delay + wiggle);
          drawable = true;
        }
      });

      return drawable;
    }

    /**
     * Draw a cube at a logical row/col.
     * @param {number} row - The row.
     * @param {number} col - The col.
     * @return {Hexagon}
     */
    function drawCube(row, col) {
      var hexagon = new Hexagon(radius, 0xffab91);

      var yOffset = smallRadius * 2 * row;
      if (col % 2 !== 0) { yOffset -= smallRadius; }

      hexagon.container.position.x = ((halfSideLength + radius) * col);
      hexagon.container.position.y = yOffset;

      hexagon.onActivate(activateHexagon);

      return hexagon;
    }

    /**
     * Build the view at a logical row/col.
     * @param {number} row - The row.
     * @param {number} col - The col.
     * @return {Cube}
     */
    function buildAtRowCol(row, col) {
      var c = Cube.evenQToCube(row, col);

      if (c.hexagon) { return c; }

      c.hexagon = drawCube(row, col);
      c.hexagon.setCube(c);

      displayContainerCenter.addChild(c.hexagon.container);

      return c;
    }

    /**
     * Clean-up and remove a hexagon.
     * @param {Hexagon} h - The hexagon.
     */
    function removeHexagon(h) {
      var c = h.getCube();

      displayContainerCenter.removeChild(h.container);

      if (c && c.hexagon) {
        c.hexagon = null;
      }
    }

    /**
     * Create all the views.
     * @return {array<Hexagon>}
     */
    function buildViews() {
      var averageHeight = smallRadius * 2;
      var rows = Math.ceil((window.innerHeight / averageHeight) / 2);

      var averageWidth = ((radius * 2) + sideLength) / 2;
      var cols = Math.ceil((window.innerWidth / averageWidth) / 2);

      var cubes = [];
      for (let row = -rows; row <= rows; row++) {
        for (let col = -cols; col <= cols; col++) {
          cubes.push(buildAtRowCol(row, col));
        }
      }

      return cubes.map(c => c.hexagon);
    }

    /**
     * When closed.
     */
    function animationCollapsed() {
      currentState = 'collapsed';

      audioManager.addTrack(currentTrack);
      removeEventListeners();
    }

    /**
     * When open.
     */
    function animationExpanded() {
      currentState = 'expand';

      audioManager.removeTrack(currentTrack);
      addEventListeners();
    }

    /**
     * Attach event listeners.
     */
    function addEventListeners() {
      if (isListening) { return; }

      isListening = true;
      hexagons.forEach(h => h.addEventListeners());
      document.addEventListener('keyup', onHexagonKeyUp);
    }

    /**
     * Detach event listeners.
     */
    function removeEventListeners() {
      if (!isListening) { return; }

      isListening = false;
      hexagons.forEach(h => h.removeEventListeners());
      document.removeEventListener('keyup', onHexagonKeyUp);
    }

    const NUMBER_KEY_RANGE = [49, 53];

    /**
     * Keyup handler for hexagons.
     * @param {event} evt - The keyup event.
     */
    function onHexagonKeyUp(evt) {
      if ((evt.keyCode >= NUMBER_KEY_RANGE[0]) && (evt.keyCode <= NUMBER_KEY_RANGE[1])) {
        var keyPos = (evt.keyCode-2) - NUMBER_KEY_RANGE[0];
        var cubePosition = Cube.evenQToCube(0,keyPos,0);
        activateHexagon(cubePosition);
      }
    }

    var lastBoundsWidth;

    /**
     * On resize.
     * @param {number} _w - The width.
     * @param {number} _h - The height.
     * @param {number} boundsWidth - The bounding box width.
     */
    function resize(_w, _h, boundsWidth) {
      if (lastBoundsWidth === boundsWidth) { return; }

      var wasListening = isListening;

      if (wasListening) {
        removeEventListeners();
      }

      hexagons.forEach(removeHexagon);

      lastBoundsWidth = boundsWidth;

      updateHexagonSizes(~~((boundsWidth / 5) / 2));

      Hexagon.clearTextureCache();
      hexagons = buildViews();

      if (wasListening) {
        addEventListeners();
      }
    }

    /**
     * Render loop.
     */
    function render(delta) {
      for (let i = 0; i < hexagons.length; i++) {
        hexagons[i].render(delta || 0);
      }
    }

    /**
     * Start recording data.
     */
    function startRecording() {
      isRecording = true;
      data.recorded = [];
    }

    /**
     * Stop recording data.
     */
    function stopRecording() {
      isRecording = false;
      currentTrack = audioManager.createRecordedTrack(
        data.recorded,
        CHANNEL,
        HEXAGON_TAG
      );
    }

    /**
     * Disable rendering.
     */
    function disable() {
      renderPause = true;
    }

    /**
     * Start rendering.
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
      name: VIEW_NAME,
      backgroundColor: 0xe34f4c,
      dataModel: HexagonDataModel,
      getData: () => data,
      getChannel: () => CHANNEL
    };
  };
})();
