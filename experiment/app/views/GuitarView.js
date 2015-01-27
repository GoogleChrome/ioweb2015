var PIXI = require('pixi.js/bin/pixi.dev.js');
var events = require('app/util/events');
var {vec2} = require('p2');
var GuitarString = require('app/views/guitar/GuitarString');
var Dot = require('app/views/guitar/Dot');
var GuitarDataModel = require('app/models/guitar');
var { GuitarStringModel, GuitarNoteModel } = GuitarDataModel;

module.exports = (function() {
  'use strict';

  const VIEW_NAME = 'GuitarView';

  /**
   * Controls the Guitar instrument view.
   * @param {AudioManager} audioManager - The shared audio manager.
   * @constructor
   */
  return function GuitarView(audioManager) {
    const GUITAR_TAG = audioManager.addTag(VIEW_NAME);
    const CHANNEL = audioManager.channels.create(0.8);

    var stage;
    var renderPause = false;

    var APPLICATION_STATE = 'collapsed';
    var displayContainerCenter;
    var pid;

    var currentRotation = 0;
    var xSpacing, ySpacing;

    var baseLayer = new PIXI.DisplayObjectContainer(); // base dots (dots non selected)
    var midLayer = new PIXI.DisplayObjectContainer(); // draw strings here
    var topLayer = new PIXI.DisplayObjectContainer(); // high dots (dots selected)

    var isDrawing = false;
    var isUndrawing = false;

    var guitarStrings = {};
    var dots = {};
    var currentDrawingPid;

    var currentBeat;
    var currentTrack;

    var isReady = false;
    var isRecording = false;
    var allData;

    var pidPool = [];

    var gridCount;

    /**
     * Add the note to the guitar note pool.
     * @param {number} pid - The pid of the note.
     */
    function addToPool(pid) {
      pidPool.push(pid);
    }

    /**
     * Remove the note from the guitar note pool.
     * @param {number} pid - The pid of the note.
     */
    function removeFromPool(pid) {
      var idx = pidPool.indexOf(pid);

      if (idx > -1) {
        pidPool.splice(idx, 1);
      }
    }

    /**
     * Initialize the guitar view.
     * @param {PIXI.Stage} stage_ - The PIXI stage of the view.
     * @param {number} pid_ - The ID of the view.
     * @param {PIXI.DisplayObjectContainer} displayContainerCenter_ - The center point of the view.
     */
    function init(stage_, pid_, displayContainerCenter_) {
      stage = stage_;
      pid = pid_;
      displayContainerCenter = displayContainerCenter_;

      displayContainerCenter.addChild(baseLayer);
      displayContainerCenter.addChild(midLayer);
      displayContainerCenter.addChild(topLayer);

      events.addListener('BEAT', function(beatNum) {
        currentBeat = beatNum;
      });

      audioManager.playbackBus.onPlayback(function(note, tags) {
        if (renderPause) { return; }

        if (tags & GUITAR_TAG) {
          if (APPLICATION_STATE === 'collapsed') {
            if (guitarStrings[note.pid]) {
              guitarStrings[note.pid].playNote();
            }
          }
        }
      });

      isReady = true;
    }

    /**
     * Load guitar data.
     * @param {Model} initialData - The guitar data.
     */
    function loadData(initialData) {
      if (currentTrack) {
        audioManager.removeTrack(currentTrack);
      }

      for (let pid in guitarStrings) {
        if (guitarStrings.hasOwnProperty(pid)) {
          guitarStrings[pid].tearDown();
          delete dots[pid];
          addToPool(pid);
        }
      }

      if (initialData.strings.length <= 0) { return; }

      allData = initialData;

      gridCount = initialData.rows * initialData.cols;
      var maxStrings = Math.ceil(gridCount / 2);

      for (let i = 0; i < maxStrings; i++) {
        addToPool(i);
      }

      createDotGrid();

      for (let i = 0; i < initialData.strings.length; i++) {
        let guitarString = createStringFromModel(initialData.strings[i]);
        guitarStrings[guitarString.getPID()] = guitarString;
      }

      currentTrack = audioManager.createRecordedTrack(
        allData.recorded,
        CHANNEL,
        GUITAR_TAG
      );

      audioManager.addTrack(currentTrack);
    }

    /**
     * Start recording the guitar note.
     */
    function startRecording() {
      isRecording = true;
      allData.recorded = [];
    }

    /**
     * Stop recording the guitar note.
     */
    function stopRecording() {
      currentTrack = audioManager.createRecordedTrack(
        allData.recorded,
        CHANNEL,
        GUITAR_TAG
      );

      isRecording = false;
    }

    /**
     * Add the recorded guitar note to the loop.
     * @param {number} pid - The pid of the note.
     * @param {string} sound - The played guitar note.
     */
    function addRecordedItem(pid, sound) {
      if (!isRecording) { return; }

      allData.recorded.push(new GuitarNoteModel({
        beat: currentBeat,
        sound: audioManager.getSound(sound).guid,
        pid: pid
      }));
    }

    /**
     * Create a new guitar string.
     * @param {Model} data - The data for each guitar string.
     */
    function createStringFromModel(data) {
      removeFromPool(data.pid);

      var dotA = dots[data.pointA];
      var dotB = dots[data.pointB];

      var guitarString = new GuitarString(audioManager, CHANNEL, new GuitarStringModel());
      guitarString.init(data.pid, midLayer, baseLayer);
      guitarString.updateSpacing(xSpacing, ySpacing);
      guitarString.onActivate(addRecordedItem);

      dotA.setString(guitarString);
      dotB.setString(guitarString);

      guitarString.setDots(dotA, dotB);

      /// Pop forward
      midLayer.setChildIndex(dotA.gridDotMiddle, midLayer.children.length - 1);
      midLayer.setChildIndex(dotB.gridDotMiddle, midLayer.children.length - 1);

      return guitarString;
    }

    /**
     * Add event listeners.
     */
    function addEventListeners() {
      stage.interactive = true;
      stage.touchstart = function(data) {
        displayContainerCenter.data = data;
      };
      stage.mousemove = stage.touchmove = function(data) {
        if (!isDrawing && !isUndrawing) {
          for (var pid in guitarStrings) {
            if (guitarStrings.hasOwnProperty(pid)) {
              guitarStrings[pid].dragMouseCollisionCheck(data);
            }
          }
        }
      };

      for (let key in dots) {
        if (dots.hasOwnProperty(key)) {
          dots[key].addEventListeners();
        }
      }
    }

    /**
     * Remove event listeners.
     */
    function removeEventListeners() {
      stage.interactive = false;
      stage.touchstart = stage.mousemove = stage.touchmove = null;

      for (let key in dots) {
        if (dots.hasOwnProperty(key)) {
          dots[key].removeEventListeners();
        }
      }
    }

    /**
     * Create the grid of dots in the guitar view.
     */
    function createDotGrid() {
      for (let pid in dots) {
        if (dots.hasOwnProperty(pid)) {
          let {
            gridDotMiddle,
            gridDot,
            gridDotUpper
          } = dots[pid];

          dots[pid].tearDown();

          baseLayer.removeChild(gridDot);
          topLayer.removeChild(gridDotUpper);
          midLayer.removeChild(gridDotMiddle);

          delete dots[pid];
        }
      }

      for (let i = 0; i < gridCount; i++) {
        let dot = new Dot(i);

        dot.onActivate(activateDot);

        let {
          gridDotMiddle,
          gridDot,
          gridDotUpper
        } = dot;

        baseLayer.addChild(gridDot);
        topLayer.addChild(gridDotUpper);
        midLayer.addChild(gridDotMiddle);

        dots[dot.pid] = dot;
      }

      updateSpacing();
      redrawDotGrid();
    }

    /**
     * Activate the dot
     * @param {Object} dot - The clicked dot.
     */
    function activateDot(dot) {
      if (isRecording) { return; }
      if (APPLICATION_STATE === 'collapsed') { return; }

      if (!isDrawing && !dot.getString() && !isUndrawing) {
        startString(dot);
      } else if (isDrawing && !dot.getString() && !isUndrawing) {
        endString(dot);
      } else if (!isDrawing && dot.getString() && !isUndrawing) {
        restartString(dot);
      } else if (!isDrawing && !dot.getString() && isUndrawing) {
        endString(dot);
      } else if (!isDrawing && !dot.getString() && isUndrawing) {
        destroyString(dot);
      } else if (isDrawing && !dot.getString() && !isUndrawing) {
        destroyString(dot);
      } else {
        var currentGuitarString = guitarStrings[currentDrawingPid];
        if (currentGuitarString && (currentGuitarString.getFirstDot() === dot)) {
          destroyString(dot);
        }
      }
    }

    /**
     * Start drawing the string from the clicked dot.
     * @param {Object} dot - The clicked dot.
     */
    function startString(dot) {
      if (isDrawing) { return; }

      var pid = pidPool.pop();
      currentDrawingPid = pid;

      isDrawing = true;

      var guitarString = new GuitarString(audioManager, CHANNEL, new GuitarStringModel());
      guitarString.init(pid, midLayer, baseLayer);
      guitarString.onActivate(addRecordedItem);
      guitarString.setFirstDot(dot);
      guitarString.updatePoints(dot.getPosition(), dot.getPosition());

      dot.setString(guitarString);

      midLayer.setChildIndex(dot.gridDotMiddle, midLayer.children.length - 1);

      guitarStrings[pid] = guitarString;

      baseLayer.interactive = true;
      baseLayer.mousemove = baseLayer.touchmove = function(data) {
        var newPosition = data.getLocalPosition(this.parent);
        guitarString.updatePointsMouse(dot.getPosition(), newPosition);
      };
    }

    /**
     * Destroy the string if dot is re-clicked without attaching the string to another dot.
     * @param {Object} dot - The clicked dot.
     */
    function destroyString(dot) {
      var guitarString = dot.getString();

      isUndrawing = false;
      isDrawing = false;

      dot.setString(null);

      var pid = guitarString.getPID();
      delete guitarStrings[pid];
      addToPool(pid);

      guitarString.destroy();

      baseLayer.interactive = false;
      baseLayer.mousemove = baseLayer.touchmove = null;
    }

    /**
     * Restart drawing the string.
     * @param {Object} dot - The clicked dot.
     */
    function restartString(dot) {
      if (isUndrawing) { return; }

      isUndrawing = true;
      var guitarString = dot.getString();
      currentDrawingPid = guitarString.getPID();

      var firstDot = guitarString.getFirstDot();

      if (firstDot === dot) {
        guitarString.setFirstDot(guitarString.getSecondDot());
        firstDot = guitarString.getFirstDot();
      }

      guitarString.setSecondDot(null);
      dot.setString(null);

      guitarString.bumpStringDepths();

      midLayer.setChildIndex(firstDot.gridDotMiddle, midLayer.children.length - 1);

      baseLayer.interactive = true;
      baseLayer.mousemove = baseLayer.touchmove = function(data) {
        data.originalEvent.preventDefault();
        var newPosition = data.getLocalPosition(this.parent);
        guitarString.updatePointsMouse(firstDot.getPosition(), newPosition);
      };
    }

    /**
     * Complete the string when end dot is clicked.
     * @param {Object} dot - The clicked dot.
     */
    function endString(dot) {
      isDrawing = false;
      isUndrawing = false;
      var guitarString = guitarStrings[currentDrawingPid];
      guitarString.setSecondDot(dot);
      guitarString.updateSpacing(xSpacing, ySpacing);
      dot.setString(guitarString);

      midLayer.setChildIndex(dot.gridDotMiddle, midLayer.children.length - 1);

      baseLayer.interactive = false;
      baseLayer.mousemove = baseLayer.touchmove = null;
    }

    /**
     * Get the position of the guitar view.
     * @param {number} x - The x position of the view.
     * @param {number} y - The x position of the view.
     * @param {number} xSpacing - The x spacing.
     * @param {number} ySpacing - The y spacing.
     */
    function getPosition(x, y, xSpacing, ySpacing) {
      var pos = vec2.fromValues(x * xSpacing, y * ySpacing);
      vec2.rotate(pos, pos, currentRotation);
      return pos;
    }

    /**
     * Redraw the dot grid.
     */
    function redrawDotGrid() {
      var startingX = -Math.floor(allData.cols / 2);

      var startX = startingX;
      var startY = -Math.floor(allData.rows / 2);
      var currentColumn = 0;

      for (let i = 0; i < gridCount; i++) {
        let position = getPosition(startX, startY, xSpacing, ySpacing);

        dots[i].setPosition(new PIXI.Point(position[0], position[1]));

        startX = startX + 1;
        currentColumn = currentColumn + 1;

        if (currentColumn > (allData.cols - 1)) {
          currentColumn = 0;
          startX = startingX;
          startY += 1;
        }
      }
    }

    /**
     * Do things when the guitar animation is collapsed.
     */
    function animationCollapsed() {
      APPLICATION_STATE = 'collapsed';

      audioManager.addTrack(currentTrack);

      removeEventListeners();
    }

    /**
     * Do things when the guitar animation is expanded.
     */
    function animationExpanded() {
      APPLICATION_STATE = 'expand';

      audioManager.removeTrack(currentTrack);

      addEventListeners();
    }

    /**
     * Resize the guitar view on resize.
     * @param {number} w - The width of the guitar view.
     * @param {number} h - The height of the guitar view.
     * @param {number} boundsWidth - The bounding width of the guitar view.
     * @param {number} boundsHeight - The bounding height of the guitar view.
     */
    var lastBoundsWidth;
    var lastBoundsHeight;
    function resize(w, h, boundsWidth, boundsHeight) {
      if (!isReady) { return; }

      lastBoundsWidth = boundsWidth;
      lastBoundsHeight = boundsHeight;

      updateSpacing();
    }

    /**
     * Update the spacing in the guitar grid.
     */
    function updateSpacing() {
      if (!allData) { return; }

      // Flipped because "default" state is vertical.
      if (lastBoundsWidth >= lastBoundsHeight) {
        xSpacing = (lastBoundsWidth / (allData.cols - 1));
        ySpacing = (lastBoundsHeight / (allData.rows - 1));
        currentRotation = 0;
      } else {
        // Y becomes X :)
        xSpacing = (lastBoundsHeight / (allData.cols - 1));
        ySpacing = (lastBoundsWidth / (allData.rows - 1));
        currentRotation = Math.PI / 2;
      }

      for (let pid in guitarStrings) {
        if (guitarStrings.hasOwnProperty(pid)) {
          var guitarString = guitarStrings[pid];
          guitarString.updateSpacing(xSpacing, ySpacing);
        }
      }

      redrawDotGrid();
    }

    /**
     * Render everything on RAF.
     * @param {number} delta - The delta.
     */
    function render(delta) {
      if (renderPause === false) {
        renderBodies(delta);
      }
    }

    /**
     * Render the guitar strings on RAF.
     * @param {number} delta - The delta.
     */
    function renderBodies(delta) {
      for (let pid in guitarStrings) {
        if (guitarStrings.hasOwnProperty(pid)) {
          guitarStrings[pid].render(delta);
        }
      }
    }

    /**
     * Disable the strings.
     */
    function disable() {
      renderPause = true;
    }

    /**
     * Enable the strings.
     */
    function enable() {
      renderPause = false;
    }

    /**
     * Get all of the string data.
     */
    function getData() {
      allData.strings = [];

      for (let pid in guitarStrings) {
        if (guitarStrings.hasOwnProperty(pid)) {
          var guitarString = guitarStrings[pid];
          allData.strings.push(guitarString.getModel());
        }
      }

      return allData;
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
      getData,
      loadData,
      name: VIEW_NAME,
      dataModel: GuitarDataModel,
      backgroundColor: 0x1564c0,
      getChannel: () => CHANNEL,
      supportsPortrait: true
    };
  };
})();
