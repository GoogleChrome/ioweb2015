var PIXI = require('pixi.js/bin/pixi.dev.js');
var Parallelogram = require('app/views/parallelogram/Parallelogram.js');
var events = require('app/util/events');
var ParallelogramDataModel = require('app/models/parallelogram');
var { ParallelogramNoteModel } = ParallelogramDataModel;


/**
 * Create view container for parallelograms.
 * @param {Object} audioManager - The audio manager.
 * @return {Object} .
 */
module.exports = (function() {
  'use strict';

  const VIEW_NAME = 'ParallelogramView';

  /**
   * Controls the Parallelogram instrument.
   * @param {AudioManager} audioManager - The shared audio manager.
   * @constructor
   */
  return function ParallelogramView(audioManager) {
    const PARALLELOGRAM_TAG = audioManager.addTag(VIEW_NAME);
    const CHANNEL = audioManager.channels.create(0.7);

    var currentTrack;
    var data;
    var currentBeat;

    var renderPause = false;
    var displayContainerCenter;
    var APPLICATION_STATE = 'collapsed';
    var pid;
    var keyEvents = [49, 50, 51, 52, 53];
    var parallelograms = [];
    var parallelogramParent;
    var startTime;
    var duration;

    const FADE_OUT_DURATION = 0.6;

    var isReady = false;
    var isRecording = false;

    /**
     * Init all of the parallelograms.
     * @param {number} pid_ - The ID of the container.
     * @param {PIXI.DisplayObjectContainer} displayContainerCenter_ - The PIXI display object.
     */
    function init(_, pid_, displayContainerCenter_) {
      parallelogramParent = new PIXI.DisplayObjectContainer();
      pid = pid_;

      displayContainerCenter = displayContainerCenter_;

      events.addListener('BEAT', function(beatNum) {
        currentBeat = beatNum;
      });

      audioManager.playbackBus.onPlayback(function(note, tags, sound) {
        if (renderPause) { return; }

        if (tags & PARALLELOGRAM_TAG) {
          var parallelogram = parallelograms[note.pid];
          if (parallelogram) {
            parallelogram.popUp(0, 0, sound);

            setTimeout(function() {
              parallelogram.popDown(FADE_OUT_DURATION);
            }, (note.duration - FADE_OUT_DURATION) * 1000);
          }
        }
      });

      isReady = true;
    }

    var sizeRatio = 280 / 170;
    var skewRatio = 90 / 170;

    /**
     * Set the parallelogram positions.
     * @param {number} index - The index of the parallelogram.
     * @param {Object} parallelogram -The parallelogram object.
     * @param {number} boundsWidth - The bounding width.
     * @param {number} boundsHeight - The bounding height.
     */
    function setPosition(index, parallelogram, boundsWidth, boundsHeight) {
      var parallelogramCount = parallelograms.length;
      var maxWidth = rotated ? boundsHeight : boundsWidth;

      var parallelogramWidth = (maxWidth / parallelogramCount) - 5;
      var parallelogramHeight = sizeRatio * parallelogramWidth;

      var skew = skewRatio * parallelogramWidth;
      parallelogramWidth -= (skew / parallelogramCount);

      parallelogram.setSize(parallelogramWidth, parallelogramHeight, skew);

      var posOffset = (skew / 2) + (parallelogramWidth * (index + 0.5));

      if (rotated) {
        parallelogram.setPosition(0, posOffset, Math.PI / 2);
      } else {
        parallelogram.setPosition(posOffset, 0, 0);
      }
    }

    /**
     * Load parallelogram data.
     * @param {Model} d - The parallelogram data.
     */
    function loadData(d) {
      if (currentTrack) {
        audioManager.removeTrack(currentTrack);
      }

      for (let i = 0; i < parallelograms.length; i++) {
        displayContainerCenter.removeChild(parallelograms[i].container);
        parallelograms[i].tearDown();
      }

      parallelograms.length = 0;

      data = d;

      for (let i = 0; i < data.parallelograms.length; i++) {
        let paralellogramDef = data.parallelograms[i];
        var parallelogram = new Parallelogram(paralellogramDef.color, paralellogramDef.hovercolor, paralellogramDef.sound, keyEvents[i], i, audioManager);
        parallelogram.onActivate(onActivate);
        parallelogram.onDeactivate(onDeactivate);
        parallelograms.push(parallelogram);

        displayContainerCenter.addChild(parallelogram.container);
      }

      updateSpacing();

      currentTrack = audioManager.createRecordedTrack(
        data.recorded,
        CHANNEL,
        PARALLELOGRAM_TAG
      );

      audioManager.addTrack(currentTrack);
    }

    /**
     * When activated, do things to the parallelogram.
     * @param {Object} parallelogram - The current parallelogram.
     * @param {number} x - The x position of the parallelogram.
     * @param {number} y - The y position of the parallelogram.
     * @param {boolean=false} dontPlay - If undefined, defaults to false.
     */
    function onActivate(parallelogram, x, y, dontPlay) {
      var didStartTime = parallelogram.popUp(x, y, dontPlay);

      if (isRecording) {
        startTime = didStartTime;
      }
    }

    /**
     * When deactivated, do things to the parallelogram.
     * @param {Object} parallelogram - The current parallelogram.
     */
    function onDeactivate(parallelogram) {
      var didEndDuration = parallelogram.popDown(FADE_OUT_DURATION);

      if (isRecording) {
        duration = didEndDuration;

        data.recorded.unshift(new ParallelogramNoteModel({
          beat: currentBeat,
          sound: audioManager.getSound(parallelogram.note).guid,
          duration: parseFloat(duration.toFixed(2)),
          pid: parallelogram.pid
        }));
      }
    }

    /**
     * Start recording the parallelogram note.
     */
    function startRecording() {
      isRecording = true;
      data.recorded = [];
    }

    /**
     * Stop recording the parallelogram note.
     */
    function stopRecording() {
      isRecording = false;
      currentTrack = audioManager.createRecordedTrack(
        data.recorded,
        CHANNEL,
        PARALLELOGRAM_TAG
      );
    }

    /**
     * Disable the paralellogram.
     */
    function disable() {
      renderPause = true;
    }

    /**
     * Enable the paralellogram.
     */
    function enable() {
      renderPause = false;
    }

    /**
     * When parallelogram view is collapsed, remove event listeners.
     */
    function animationCollapsed() {
      APPLICATION_STATE = 'collapsed';

      audioManager.addTrack(currentTrack);
      removeEventListeners();
    }

    /**
     * When parallelogram view is expanded, add event listeners.
     */
    function animationExpanded() {
      APPLICATION_STATE = 'expand';

      audioManager.removeTrack(currentTrack);
      addEventListeners();
    }

    /**
     * Add event listeners.
     */
    function addEventListeners() {
      parallelograms.forEach(p => p.addEventListeners());
    }

    /**
     * Remove event listeners.
     */
    function removeEventListeners() {
      parallelograms.forEach(p => p.removeEventListeners());
    }

    var width, height, lastBoundsWidth, lastBoundsHeight;
    var rotated;

    /**
     * Do things on window resize.
     * @param {number} w - The width of the window.
     * @param {number} h - The height of the window.
     * @param {number} boundsWidth - The bounding width.
     * @param {number} boundsHeight - The bounding height.
     */
    function resize(w, h, boundsWidth, boundsHeight) {
      width = w;
      height = h;

      lastBoundsWidth = boundsWidth;
      lastBoundsHeight = boundsHeight;

      updateSpacing();
    }

    /**
     * Update parallelogram spacing.
     */
    function updateSpacing() {
      // Flipped because "default" state is vertical.
      rotated = lastBoundsWidth < lastBoundsHeight;

      var pCount = parallelograms.length;
      var halfP = pCount / 2;

      for (let i = 0; i < pCount; i++) {
        let parallelogram = parallelograms[i];
        setPosition(-halfP + i, parallelogram, lastBoundsWidth, lastBoundsHeight);
      }
    }

    /**
     * Render the expanded parallelograms state.
     */
    function render() {
      // no-op
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
      backgroundColor: 0x5bdbee,
      dataModel: ParallelogramDataModel,
      getData: () => data,
      getChannel: () => CHANNEL,
      supportsPortrait: true
    };

  };
})();
