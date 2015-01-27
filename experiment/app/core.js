var RootView = require('app/views/Root');
var AudioManager = require('app/audio/AudioManager');
var StateManager = require('app/util/StateManager');
var style = require('app/styles/experiment.css');
var audioSpriteDefault = require('app/data/normalaudiosprite.json');
var audioSpriteCat = require('app/data/cataudiosprite.json');
var audioLoopsDefault = require('app/data/loops.json');
var audioLoopsCat = require('app/data/catloops.json');
var {Promise} = require('es6-promise');

/**
 * Main entry point into the experiment.
 * @constructor
 */
module.exports = function Experiment() {
  'use strict';

  var audioManager;
  var rootView;
  var stateManager;

  var d = new Date();
  var isAprilFools = (d.getMonth() === 3) && (d.getDate() === 1);
  var isCatMode = isAprilFools || window.location.href.match(/meow/);

  var self = {
    load,
    start,
    serialize,
    tearDown,
    pause,
    play,
    didEnterRecordingMode,
    didExitRecordingMode,
    reloadData
  };

  /**
   * Load the experiment data and audio files.
   * @param {Object} audioSprite - The sprited audio file.
   * @param {array} audioLoops - The array of audio loops.
   */
  function load(audioSprite = audioSpriteDefault, audioLoops = audioLoopsDefault) {
    // Prepare experiment-specific styles.
    style.use();

    if (isCatMode) {
      audioSprite = audioSpriteCat;
      audioLoops = audioLoopsCat;
    }

    // Create the AudioManager, which controls all sound in the experiment.
    audioManager = new AudioManager();
    audioManager.init();

    stateManager = new StateManager();

    // Create the RootView, which controls all visuals in the experiment.
    rootView = new RootView(audioManager, stateManager);

    // Define the mapping of sound names to their location in the audio sprite.
    audioManager.defineSounds(audioSprite.spritemap, audioManager);

    // Define looping sounds, which are made up of sounds defined above.
    audioManager.defineSoundLoops(audioLoops, audioManager);

    // Load the audio sprite.
    audioManager.load(audioSprite.resources[0]).then(function() {
      // If the `window.experiment` variable exists, wait for it to initialize us.
      // Otherwise, auto-start.
      if (window.experiment && ('function' === typeof window.experiment.didFinishLoading)) {
        window.experiment.didFinishLoading(self);
      } else {
        start();
      }
    });
  }

  /**
   * Start animating and playing sound.
   * @param {string} instrumentSelector - The means of gathering large instrument boxes on the base page.
   * @param {string} visualizerSelector - The means of gathering smaller visualizer cards on the base page.
   * @param {array<number>} fromPos - The origin point of the transition in (FAB).
   */
  function start(instrumentSelector = '.row', visualizerSelector = '.box', fromPos = [0,0]) {
    // Start sound engine.
    audioManager.fadeIn(2.25, 0.75);

    // Find base elements and layout views.
    rootView.init(instrumentSelector, visualizerSelector);

    // Load either serialized state or default state.
    stateManager.init();
    stateManager.loadSerializedOrDefault();

    // Start requestAnimationFrame
    rootView.start();

    // Animate transition in.
    setTimeout(function() {
      rootView.animateIn(fromPos);
    }, 50);
  }

  const SHORTENER_API_URL = 'https://www.googleapis.com/urlshortener/v1/url';
  const SHORTENER_API_KEY = 'AIzaSyBRMm_PwR1cfjT_yLxBiV9PDrwZPRIRLxg';

  /**
   * Serialize the entire experiment to URL encoded data.
   */
  function serialize() {
    var fullURL = window.location.origin + window.location.pathname + '?composition=' + stateManager.toURL();
    var endpoint = `${SHORTENER_API_URL}?key=${SHORTENER_API_KEY}`;

    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();

      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');

      var jsonStr = JSON.stringify({
        longUrl: fullURL
      });

      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          try {
            var data = JSON.parse(this.responseText);
            resolve(data.id);
          } catch(e) {
            reject('Parsing URL Shortener result failed.');
          }
        } else if (xhr.status !== 200) {
          reject('Requesting URL Shortener result failed.');
        }
      };

      xhr.send(jsonStr);
    });
  }

  /**
   * Shut down the experiment.
   * @param {array<number>} fromPos - The origin point of the transition in (FAB).
   * @return {Promise}
   */
  function tearDown(fromPos = [0,0]) {
    // Stop sound engine.
    audioManager.fadeOut(0.5).then(function() {
      audioManager.tearDown();
    });

    // Animate transition out.
    return rootView.animateOut(fromPos).then(function() {
      // Remove DOM nodes.
      rootView.cleanUp();
    });
  }

  /**
   * Pause the experiment audio.
   */
  function pause() {
    audioManager.fadeOut(0.75);
  }

  /**
   * Play the experiment audio.
   */
  function play() {
    audioManager.fadeIn(0.75);
  }

  /**
   * If entering record mode.
   * @param {function} cb - The enter callback
   */
  function didEnterRecordingMode(cb) {
    rootView.didEnterRecordingMode(cb);
  }

  /**
   * If exiting record mode.
   * @param {function} cb - The exit callback
   */
  function didExitRecordingMode(cb) {
    rootView.didExitRecordingMode(cb);
  }

  /**
   * Reload the global state.
   */
  function reloadData() {
    rootView.reloadData();
  }

  return self;
};
