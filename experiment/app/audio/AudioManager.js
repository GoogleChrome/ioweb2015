var Sequencer = require('app/audio/Sequencer');
var Sound = require('app/audio/Sound');
var SoundLoop = require('app/audio/SoundLoop');
var PlaybackBus = require('app/audio/PlaybackBus');
var ChannelManager = require('app/audio/ChannelManager');
var Tags = require('app/audio/Tags');
var { loadBuffer } = require('app/util/BufferLoader');
var assetPath = require('app/util/assetPath');
var addVisibilityChangeListener = require('app/util/addVisibilityChangeListener');
var unlockAudioOnMobile = require('app/util/unlockAudioOnMobile');
var animate = require('app/util/animate');

/**
 * Central controller for all Audio.
 * @constructor
 */
module.exports = (function() {
  'use strict';

  /**
   * Main manager for all audio.
   * @constructor
   */
  return function AudioManager() {
    var sequencer;

    var sounds;
    var soundsByGUID;
    var soundLoops = {};
    var soundLoopsByGUID;
    var removeVisibilityChangeListener;

    var AudioConstructor = window.AudioContext || window.webkitAudioContext;
    var audioContext = new AudioConstructor();

    // Central volume control node.
    var gainNode = audioContext.createGain();

    const DEFAULT_VOLUME = 1.0;
    setVolume(DEFAULT_VOLUME);

    // Central audio analyzer node.
    var analyser = audioContext.createAnalyser();
    gainNode.connect(analyser);

    var playbackBus = new PlaybackBus();

    var isRunning = false;

    var channels = new ChannelManager(audioContext, gainNode);

    var self = {
      init,
      tearDown,
      analyser,
      audioContext,
      playbackBus,
      load,
      defineSounds,
      defineSoundLoops,
      channels,
      setVolume,
      addTrack,
      removeTrack,
      createTrack,
      createLoopingTrack,
      createRecordedTrack,
      fadeOut,
      fadeIn,
      willPlayback,
      render,
      playSoundImmediately,
      playSoundOnNextBeat,
      getSound,
      getSoundLoop,
      getSequencer: () => sequencer,
      addTag: (n) => Tags.addTag(n),
      getTag: (n) => Tags.getTag(n),
      noteDuration: () => sequencer.noteDuration
    };

    /**
     * Initialize the sequencer, watch tab change events
     * and work around iOS audio limitations.
     */
    function init() {
      sequencer = new Sequencer(self);

      removeVisibilityChangeListener = addVisibilityChangeListener(function() {
        fadeIn(2.25, 0.75);
      }, stop);

      unlockAudioOnMobile(audioContext);
    }

    /**
     * Shut down everything.
     */
    function tearDown() {
      removeVisibilityChangeListener();
    }

    /**
     * Set the overall volume of audio.
     * @param {number} vol - The new volume (0.0-1.0).
     */
    function setVolume(vol) {
      gainNode.gain.value = vol;
    }

    /**
     * Fade the audio volume in.
     * @param {number} duration - The fade in duration.
     * @param {number} delay - The fade in delay.
     */
    function fadeIn(duration, delay) {
      start();

      return animate({ volume: 0 }, duration, {
        volume: DEFAULT_VOLUME,
        delay: delay || 0,
        ease: Linear.easeNone,
        onUpdate: function() {
          setVolume(this.target.volume);
        }
      });
    }

    /**
     * Fade the audio volume out then stop.
     * @param {number} duration - The fade out duration.
     */
    function fadeOut(duration) {
      return animate({ volume: gainNode.gain.value }, duration, {
        volume: 0,
        ease: Linear.easeNone,
        onUpdate: function() {
          setVolume(this.target.volume);
        }
      }).then(function() {
        stop();
      });
    }

    /**
     * Start the audio manager.
     */
    function start() {
      if (isRunning) { return; }

      setVolume(0);

      analyser.connect(audioContext.destination);

      isRunning = true;
      sequencer.start();
    }

    /**
     * Stop the audio manager.
     */
    function stop() {
      if (!isRunning) { return; }

      analyser.disconnect();

      isRunning = false;
      sequencer.stop();
    }

    /**
     * Create a track, which is a sequence of notes playing on a channel.
     * @param {object} notes - Beat numbers to sound name mapping.
     * @param {Channel} channel - The channel to play on.
     * @param {number} tags - Identifying data for a track.
     * @return {Track}
     */
    function createTrack(notes, channel, tags) {
      return sequencer.createTrack(notes, channel, tags);
    }

    /**
     * Create a track, which loops a single sound every so often
     * @param {string} sound - Name of the sound to loop.
     * @param {number} frequency - How often to play the sound.
     * @param {Channel} channel - The channel to play on.
     * @param {number} tags - Identifying data for a track.
     * @return {Track}
     */
    function createLoopingTrack(sound, frequency, channel, tags) {
      return sequencer.createLoopingTrack(sound, frequency, channel, tags);
    }

    /**
     * Create a track from a list of played notes.
     * @param {array<object>} playedNotes - The played notes.
     * @param {Channel} channel - The channel.
     * @param {number} tags - The tags.
     * @return {Track}
     */
    function createRecordedTrack(playedNotes, channel, tags) {
      var trackDef = {};

      for (let i = 0; i < playedNotes.length; i++) {
        var beatNum = playedNotes[i].beat;
        trackDef[beatNum] = trackDef[beatNum] || [];
        trackDef[beatNum].push(playedNotes[i]);
      }

      return createTrack(trackDef, channel, tags);
    }

    /**
     * Add a track.
     * @param {Track} track - The track.
     */
    function addTrack(track) {
      sequencer.addTrack(track);
    }

    /**
     * Remove a track.
     * @param {Track} track - The track.
     */
    function removeTrack(track) {
      sequencer.removeTrack(track);
    }

    /**
     * Add a single sound definition.
     * @param {string} name - The unique name of the sound.
     * @param {string} path - The URL of the source asset.
     * @param {array?} filters - A set of Tuna filter descriptions to apply.
     */
    function defineSound(name, start, end, audioManager) {
      return new Sound(audioManager, start, end, name);
    }

    /**
     * Add several sound definitions.
     * @param {soundDefs} sounds - Several sound definitions.
     */
    function defineSounds(soundDefs, audioManager) {
      sounds = {};
      soundsByGUID = {};

      for (let soundName in soundDefs) {
        if (soundDefs.hasOwnProperty(soundName)) {
          let def = soundDefs[soundName];
          let s = defineSound(soundName, def.start, def.end, audioManager);
          sounds[soundName] = s;
          soundsByGUID[s.guid] = s;
        }
      }
    }

    /**
     * Add a single loop sound definition.
     * @param {string} name - The unique name of the sound.
     * @param {object} beats - The list of sounds and their beats.
     * @param {array?} filters - A set of Tuna filter descriptions to apply.
     */
    function defineSoundLoop(name, beats, audioManager) {
      return new SoundLoop(audioManager, name, beats);
    }

    /**
     * Add several sound definitions.
     * @param {object} loopDefs - Several sound definitions.
     */
    function defineSoundLoops(soundDefs, audioManager) {
      soundLoops = {};
      soundLoopsByGUID = {};

      for (var i = 0; i < soundDefs.length; i++) {
        var def = soundDefs[i];
        var s = defineSoundLoop(def.name, def.beats, audioManager);
        soundLoops[def.name] = s;
        soundLoopsByGUID[s.guid] = s;
      }
    }

    /**
     * Get an sound by name.
     * @param {string} name - The sound name.
     * @return {Sound}
     */
    function getSound(name) {
      if ('number' === typeof name) {
        return soundsByGUID[name];
      } else {
        return sounds[name];
      }
    }

    /**
     * Get an sound loop by name.
     * @param {string} name - The sound loop name.
     * @return {Sound}
     */
    function getSoundLoop(name) {
      if ('number' === typeof name) {
        return soundLoopsByGUID[name];
      } else {
        return soundLoops[name];
      }
    }

    /**
     * Play a sound immediately.
     * @param {string|number} soundName - The sound.
     * @param {Channel} channel - The channel.
     * @return {AudioNode}
     */
    function playSoundImmediately(soundName, channel) {
      var channelOut = channel ? channel.target : gainNode;
      return getSound(soundName).play(channelOut);
    }

    /**
     * Play a sound on next sequencer beat.
     * @param {string|number} soundName - The sound.
     * @param {Channel} channel - The channel.
     * @return {AudioNode}
     */
    function playSoundOnNextBeat(soundName, channel) {
      var channelOut = channel ? channel.target : gainNode;
      sequencer.playNext(getSound(soundName), channelOut);
    }

    /**
     * Load the sounds.
     */
    function load(url) {
      return loadBuffer(audioContext, assetPath(url)).then(function(buffer) {
        for (let key in sounds) {
          if (sounds.hasOwnProperty(key)) {
            sounds[key].setBuffer(buffer);
          }
        }
      });
    }

    /**
     * Notify the playback bus that a sound will play in the future.
     * @param {Sound} sound - The sound.
     * @param {number} time - The time.
     * @param {number} note - Which note.
     * @param {number} tags - The tags.
     */
    function willPlayback(sound, time, note, tags) {
      playbackBus.schedule(time - audioContext.currentTime, sound, note, tags);
    }

    /**
     * When ticking, progress the playback bus.
     * @param {number} delta - The delta.
     */
    function render(delta) {
      playbackBus.tick(delta);
    }

    return self;
  };
})();
