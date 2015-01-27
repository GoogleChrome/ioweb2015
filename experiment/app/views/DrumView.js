var PIXI = require('pixi.js/bin/pixi.dev.js');
var p2 = require('p2');
var events = require('app/util/events');
var DotEmitter = require('app/views/drum/DotEmitter');
var Drum = require('app/views/drum/Drum');
var DrumsDataModel = require('app/models/drums');
var { DrumNoteModel } = DrumsDataModel;

module.exports = (function() {
  'use strict';

  const VIEW_NAME = 'DrumView';

  /**
   * Controls the Drum instrument view.
   * @param {AudioManager} audioManager - The shared audio manager.
   * @constructor
   */
  return function DrumView(audioManager) {
    var world = new p2.World({
      gravity: [0, -900.78]
    });

    world.applySpringForces = false;
    world.applyDamping = false;
    world.emitImpactEvent = false;

    var stage;
    var data;

    const DRUM_TAG = audioManager.addTag(VIEW_NAME);
    const CHANNEL = audioManager.channels.create(0.6);

    var drums = [];
    var drumLookup = {};

    var groundT;

    var dotEmitterObj = {};

    var ground;
    var foreground;
    var background;

    var PIDINC = 0;
    var renderPause = false;
    var displayContainerCenter;

    var APPLICATION_STATE = 'collapsed';
    var pid;
    var DropballEntityPIDInc = 6000;

    var emitters;

    var isReady = false;
    var isRecording = false;
    var currentBeat;
    var currentTrack;

    var maxWidth = 1100;
    var maxHeight = 700;

    /**
     * Initialize the drum view.
     * @param {PIXI.Stage} stage_ - The PIXI stage of the view.
     * @param {number} pid_ - The pid of the note.
     * @param {PIXI.DisplayObjectContainer} displayContainerCenter_ - The center point of the view.
     */
    function init(stage_, pid_, displayContainerCenter_) {
      stage = stage_;
      pid = pid_;
      displayContainerCenter = displayContainerCenter_;

      groundT = new PIXI.DisplayObjectContainer();
      displayContainerCenter.addChild(groundT);

      foreground = new PIXI.DisplayObjectContainer();
      background = new PIXI.DisplayObjectContainer();

      displayContainerCenter.addChild(background);
      displayContainerCenter.addChild(foreground);

      ground = addBody(groundT, 0, -maxHeight, 4000, 10);

      world.on('postBroadphase', function({ pairs }) {
        for (var i = pairs.length - 2; i >= 0; i -= 2) {
          var b1 = pairs[i];
          var b2 = pairs[i + 1];

          var areBothBalls = (b1.customType === 'ball') && (b2.customType === 'ball');

          if (areBothBalls) {
            pairs.splice(i, 2);
          }
        }
      });

      world.on('beginContact', function(event) {
        collisionStart(event.bodyA, event.bodyB);
      });

      events.addListener('BEAT', function(beatNum) {
        currentBeat = beatNum;
      });

      audioManager.playbackBus.onPlayback(function(note, tags) {
        if (renderPause) { return; }

        if (tags & DRUM_TAG) {
          if (APPLICATION_STATE === 'collapsed') {
            var d = drumLookup[note.pid];

            if (d) {
              d.showCollision();
            }
          }
        }
      });

      isReady = true;
    }

    /**
     * Record each drum sound
     * @param {Model} d - The drum data.
     */
    function recordSound(d) {
      if (!isRecording) { return; }

      data.recorded.push(new DrumNoteModel({
        beat: currentBeat,
        pid: d.pid,
        sound: audioManager.getSound(d.soundName).guid
      }));
    }

    /**
     * Start recording the drum notes.
     */
    function startRecording() {
      isRecording = true;

      data.recorded = [];
    }

    /**
     * Stop recording the drum notes.
     */
    function stopRecording() {
      isRecording = false;

      currentTrack = audioManager.createRecordedTrack(
          data.recorded,
          CHANNEL,
          DRUM_TAG
          );
    }

    /**
     * Get the next drum PID.
     */
    function getNextPID() {
      DropballEntityPIDInc = DropballEntityPIDInc + 1;
      return DropballEntityPIDInc;
    }

    /**
     * Load all of the drum data.
     * @param {Model} d - The drum data.
     */
    function loadData(d) {
      if (currentTrack) {
        audioManager.removeTrack(currentTrack);
      }

      for (let i = 0; i < drums.length; i++) {
        drums[i].tearDown();

        foreground.removeChild(drums[i].container);
        background.removeChild(drums[i].hitCircleContainer);
        delete drumLookup[drums[i].pid];
      }

      data = d;

      currentTrack = audioManager.createRecordedTrack(
        data.recorded,
        CHANNEL,
        DRUM_TAG
      );

      audioManager.addTrack(currentTrack);

      drums = data.drums.map(function(drumDef) {
        var drum = new Drum(drumDef, drumDef.color, drumDef.hovercolor, drumDef.sound, world);

        drum.setPosition(drumDef.x, drumDef.y);

        drum.onActivate(function(d) {
          audioManager.playSoundOnNextBeat(d.soundName, CHANNEL);
          recordSound(d);
        });

        foreground.addChild(drum.container);
        background.addChild(drum.hitCircleContainer);
        drumLookup[drum.pid] = drum;

        return drum;
      });

      emitters = data.emitters.map(function(emitterDef) {
        var e = new DotEmitter(audioManager);
        e.init(stage, displayContainerCenter, world, emitterDef.x, emitterDef.y, dotEmitterObj, getNextPID, emitterDef.beatModulo, audioManager);
        return e;
      });
    }

    /**
     * Add drum bodies.
     * @param {PIXI.DisplayObjectContainer} sprite - The drum sprite.
     * @param {number} x - The x position of the drum body.
     * @param {number} y - The y position of the drum body.
     * @param {number} width - The width of the drum body.
     * @param {number} height - The height of the drum body.
     * @param {number} density - The density of the drum body.
     */
    function addBody(sprite, x, y, width, height, density) {
      var shapeDef;
      var bodyDef;

      if (density) {
        shapeDef = new p2.Circle(width);
        bodyDef = new p2.Body({
          position: [x, y],
          mass: 1,
          angularVelocity: 10,
          angle: 1,
          velocity: [1, 1],
          damping: 0.05
        });
      } else if (sprite === groundT) {
        shapeDef = new p2.Rectangle(width, height);
        bodyDef = new p2.Body({
          position: [x, y],
          mass: 0,
          type: 4
        });
      }

      bodyDef.addShape(shapeDef);
      world.addBody(bodyDef);

      var body = bodyDef;

      if (density) {
        body.customType = 'ball';
      } else if (sprite === groundT) {
        body.customType = 'floor';
      }

      body.pid = PIDINC;
      body.worlds = world;

      PIDINC = PIDINC + 1;
      return body;
    }

    /**
     * Dot collisions.
     * @param {Object} bodyA - The dot being dropped.
     * @param {Object} bodyB - The dot being hit.
     */
    function collisionStart(bodyA, bodyB) {
      if (bodyB.customType === 'floor') {
        dotEmitterObj[bodyA.pid].destroy();
        delete dotEmitterObj[bodyA.pid];
      }
    }

    /**
     * Pause drum view.
     */
    function disable() {
      renderPause = true;
    }

    /**
     * Unpause drum view.
     */
    function enable() {
      renderPause = false;
    }

    /**
     * When drum animation is collapsed.
     */
    function animationCollapsed() {
      APPLICATION_STATE = 'collapsed';

      cleanupDots();

      audioManager.addTrack(currentTrack);
      removeEventListeners();
    }

    /**
     * When drum animation is expanded.
     */
    function animationExpanded() {
      APPLICATION_STATE = 'expand';

      audioManager.removeTrack(currentTrack);
      addEventListeners();
    }

    /**
     * Kill all living dots.
     */
    function cleanupDots() {
      for (let i = 0; i < emitters.length; i++) {
        emitters[i].killAllDots();
      }
    }

    /**
     * Add event listeners.
     */
    function addEventListeners() {
      events.addListener('BEAT', onBeat);

      drums.forEach(d => d.addEventListeners());
    }

    /**
     * Remove event listeners.
     */
    function removeEventListeners() {
      events.removeListener('BEAT', onBeat);

      drums.forEach(d => d.removeEventListeners());
    }

    /**
     * On beat, emit beat number.
     * @param {number} beatNumber - The current beat number.
     */
    function onBeat(beatNumber) {
      for (let i = 0; i < emitters.length; i++) {
        emitters[i].onBeat(beatNumber);
      }
    }

    /**
     * On resize, resize the guitar view.
     * @param {number} w - The width of the guitar view.
     * @param {number} h - The height of the guitar view.
     * @param {number} optimalWidth - The optimal width of the guitar view.
     */
    function resize(w, h, optimalWidth) {
      if (!isReady) { return; }

      var zoom = optimalWidth / maxWidth;
      displayContainerCenter.scale.x = zoom;  // zoom in
      displayContainerCenter.scale.y = -zoom; // Note: we flip the y axis to make 'up' the physics 'up'
    }

    /**
     * Render the drums on RAF.
     * @param {number} delta - The delta.
     */
    function render(delta) {
      if (renderPause) { return; }

      if (APPLICATION_STATE === 'expand') {
        renderBodies(delta);
        world.step(1 / 60);
      }
    }

    /**
     * Render the drum view bodies.
     * @param {number} delta - The delta.
     */
    function renderBodies(delta) {
      for (let i = 0; i < drums.length; i++) {
        drums[i].render(delta);
      }

      groundT.position.y = ground.position[1];
      groundT.position.x = ground.position[0] - 2000;

      for (let pid in dotEmitterObj) {
        if (dotEmitterObj.hasOwnProperty(pid)) {
          dotEmitterObj[pid].render();
        }
      }
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
      dataModel: DrumsDataModel,
      getData: () => data,
      backgroundColor: 0x7c4dff,
      getChannel: () => CHANNEL
    };
  };
})();
