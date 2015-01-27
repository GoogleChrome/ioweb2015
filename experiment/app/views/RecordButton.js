var PIXI = require('pixi.js/bin/pixi.dev.js');
var animate = require('app/util/animate');
var events = require('app/util/events');
var retinaInlineSprite = require('app/util/retinaInlineSprite');
var recordImage = require('url?limit=10000!app/images/record-button.png');
var checkmarkImage = require('url?limit=10000!app/images/checkmark.png');
var oneNumber = require('url?limit=10000!app/images/1.png');
var twoNumber = require('url?limit=10000!app/images/2.png');
var threeNumber = require('url?limit=10000!app/images/3.png');
var fourNumber = require('url?limit=10000!app/images/4.png');
var fiveNumber = require('url?limit=10000!app/images/5.png');
var sixNumber = require('url?limit=10000!app/images/6.png');
var sevenNumber = require('url?limit=10000!app/images/7.png');
var eightNumber = require('url?limit=10000!app/images/8.png');
var nineNumber = require('url?limit=10000!app/images/9.png');
var tenNumber = require('url?limit=10000!app/images/10.png');
var getReadyImage = require('url?limit=10000!app/images/get-ready.png');
var recordingImage = require('url?limit=10000!app/images/recording.png');
var recordingComplete = require('url?limit=10000!app/images/recording-complete.png');

module.exports = (function() {
  'use strict';

  const WHITE = 0xFFFFFF;
  const BLACK = 0x000000;
  const BOUNDS_PADDING = 5;
  const CIRCLE_RADIUS = 28;

  var circleGraphics = new PIXI.Graphics();

  circleGraphics.boundsPadding = 2;
  circleGraphics.beginFill(WHITE, 1);
  circleGraphics.drawCircle(0, 0, CIRCLE_RADIUS);
  circleGraphics.endFill();

  var circleTexture = circleGraphics.generateTexture(window.devicePixelRatio > 1.5 ? 2 : 1);

  return function RecordButton(audioManager) {
    var startBeat;
    var internalStartBeat;
    var prevWholeNumber;

    var sequencer = audioManager.getSequencer();

    var isRecording = false;
    var isCountdown = false;
    var startedRecordingTime = 0;
    var startedCountingTime = 0;

    var numberImages = [oneNumber, twoNumber, threeNumber, fourNumber,
      fiveNumber, sixNumber, sevenNumber, eightNumber, nineNumber, tenNumber];
    var numberImagePixiObjects = [];

    var container = new PIXI.DisplayObjectContainer();

    container.interactive = false;
    container.buttonMode = true;

    var circle = new PIXI.Sprite(circleTexture);

    var shadow = new PIXI.Graphics();
    var blurFilter = new PIXI.BlurFilter();
    blurFilter.blur = 4;
    shadow.boundsPadding = BOUNDS_PADDING;
    shadow.beginFill(BLACK, 0.6);
    shadow.drawCircle(0, 0, CIRCLE_RADIUS);
    shadow.filters = [blurFilter];
    shadow.endFill();
    shadow.scale.x = 0.96;
    shadow.scale.y = 0.96;
    shadow.position.x = CIRCLE_RADIUS + 2;
    shadow.position.y = CIRCLE_RADIUS + 5;

    var arcCircle = new PIXI.Graphics();
    arcCircle.rotation = -Math.PI / 2;
    arcCircle.position.y = 60;

    var mintCircle = new PIXI.Graphics();
    mintCircle.lineStyle(10, 0xB7F7C9, 1);
    mintCircle.beginFill(0xFFFFFF, 1);
    mintCircle.drawCircle(CIRCLE_RADIUS + 2, CIRCLE_RADIUS + 2, CIRCLE_RADIUS - 8);
    mintCircle.endFill();
    mintCircle.alpha = 0;

    var recordIcon = retinaInlineSprite(recordImage);
    recordIcon.position.x = CIRCLE_RADIUS + 2;
    recordIcon.position.y = CIRCLE_RADIUS + 2;
    recordIcon.anchor.set(0.5, 0.5);

    var checkmarkCircle = retinaInlineSprite(checkmarkImage);
    checkmarkCircle.position.x = CIRCLE_RADIUS + 2;
    checkmarkCircle.position.y = CIRCLE_RADIUS + 2;
    checkmarkCircle.anchor.set(0.5, 0.5);
    checkmarkCircle.alpha = 0;
    checkmarkCircle.scale.x = 0;
    checkmarkCircle.scale.y = 0;

    var readyText = retinaInlineSprite(getReadyImage);
    var recordingText = retinaInlineSprite(recordingImage);
    var recordingCompleteText = retinaInlineSprite(recordingComplete);
    var textImages = [readyText, recordingText, recordingCompleteText];

    for (let i = 0; i < textImages.length; i++) {
      let textImage = textImages[i];
      textImage.position.x = -205;
      textImage.position.y = 30;
      textImage.alpha = 0;
      container.addChild(textImage);
    }

    container.addChild(shadow);
    container.addChild(circle);
    container.addChild(mintCircle);
    container.addChild(arcCircle);
    container.addChild(recordIcon);
    container.addChild(checkmarkCircle);

    for (let i = 0; i < numberImages.length; i++) {
      let numberImage = retinaInlineSprite(numberImages[i]);
      numberImage.position.x = CIRCLE_RADIUS + 1;
      numberImage.position.y = CIRCLE_RADIUS + 2;
      numberImage.anchor.set(0.5, 0.5);
      numberImage.alpha = 0;
      container.addChild(numberImage);
      numberImagePixiObjects.push(numberImage);
    }

    container.hitArea = circle;

    var self = {
      clearCircle,
      resetRecord,
      container,
      onCountdownActivate,
      onRecordActivate,
      onRecordDeactivate,
      recordIcon,
      circle,
      arcCircle,
      checkmarkCircle,
      textImages,
      render,
      addEventListeners,
      removeEventListeners,
      numberImagePixiObjects
    };

    var onRecordActivateCallback;
    var loopLengthInSeconds = sequencer.loopLengthSecs();

    var currentBeat;

    events.addListener('BEAT', function(beatNum) {
      currentBeat = beatNum;

      if (currentBeat === 0 && isCountdown && !isRecording) {
        setupRecording();
      }

    });

    /**
     * Get the time to first beat in seconds
     */
    function timeToFirstBeat() {
      var beats = sequencer.loopLength() - currentBeat;
      return beats * sequencer.beatLength();
    }

    var onCountdownActivateCallback;

    /**
     * When countdown activated, pass the callback to the function.
     * @param {function} cb - The callback to run.
     */
    function onCountdownActivate(cb) {
      onCountdownActivateCallback = cb;
    }

    /**
     * When activated, pass the callback to the function.
     * @param {function} cb - The callback to run.
     */
    function onRecordActivate(cb) {
      onRecordActivateCallback = cb;
    }

    var onRecordDeactivateCallback;

    /**
     * When deactivated, pass the callback to the function.
     * @param {function} cb - The callback to run.
     */
    function onRecordDeactivate(cb) {
      onRecordDeactivateCallback = cb;
    }

    /**
     * Add event listeners.
     */
    function addEventListeners() {
      container.interactive = true;

      container.click = container.tap = function() {
        if (!isCountdown) {
          startBeat = timeToFirstBeat();
          internalStartBeat = timeToFirstBeat();
          prevWholeNumber = timeToFirstBeat();
          container.interactive = false;
          setupCountdown();
        }
      };
    }

    /**
     * Remove event listeners.
     */
    function removeEventListeners() {
      container.interactive = false;
      container.click = container.tap = null;
    }

    /**
     * Show text
     * @param {Object} textElement - The element to show
     */
    function showText(textElement) {
      animate.to(textElement, 0.3, {
        alpha: 1,
        y: -10
      });
    }

    /**
     * Hide text
     * @param {Object} textElement - The element to show
     * @param {number} delayDuration - The time to delay before hiding
     */
    function hideText(textElement, delayDuration) {
      animate.to(textElement, 0.3, {
        delay: delayDuration,
        alpha: 0,
        y: -30
      });
    }

    /**
     * Animate the countdown numbers
     * @param {Object} numberImageGraphic - The number to countdown
     */
    function countdownNumber(numberImageGraphic) {
      animate.to(numberImageGraphic, 0.1, {
        alpha: 1
      });

      animate.fromTo(numberImageGraphic.scale, 0.15, {
        x: 0.7,
        y: 0.7
      }, {
        x: 1.1,
        y: 1.1
      }).then(hideNumber.bind(null, numberImageGraphic));
    }

    /**
     * Hide the countdown numbers
     * @param {Object} numberImageGraphic - The number to countdown
     */
    function hideNumber(numberImageGraphic) {
      animate.to(numberImageGraphic.scale, 0.15, {
        delay: 0.6,
        x: 0.5,
        y: 0.5
      });

      animate.to(numberImageGraphic, 0.2, {
        delay: 0.6,
        alpha: 0
      });
    }

    /**
     * Set up the countdown circle
     */
    function setupCountdown() {
      onCountdownActivateCallback(self);
      isCountdown = true;
      startedCountingTime = 0;
      animate.fromTo(recordIcon.scale, 0.4, {
        x: 1.01,
        y: 1.01
      }, {
        x: 0,
        y: 0
      });
      animate.to(textImages[0], 0.3, {
        alpha: 1,
        y: -10
      });
    }

    /**
     * Set up the recording circle
     */
    function setupRecording() {
      onRecordActivateCallback(self);
      isCountdown = false;
      isRecording = true;
      startedRecordingTime = 0;
      animate.to(textImages[0], 0.3, {
        alpha: 0,
        y: -30
      });
      animate.to(mintCircle, 0.5, {
        alpha: 1
      });
      animate.fromTo(textImages[1], 0.3, {
        alpha: 0,
        y: 30
      }, {
        delay: 0.3,
        alpha: 1,
        y: -10
      });
    }

    /**
     * On render, do things
     * @param {number} delta - requestAnimationFrame delta
     */
    function render(delta) {

      if (isCountdown) {
        if (startedCountingTime >= startBeat) {
          startedCountingTime = 0;
          prevWholeNumber = 0;
        } else if (startedCountingTime <= startBeat) {
          radialAnimation(0xFF4A00, startedCountingTime, startBeat);
          startedCountingTime += delta;

          var wholeNumber = Math.ceil(internalStartBeat -= delta);

          if (wholeNumber < prevWholeNumber) {
            prevWholeNumber = wholeNumber;
            if (wholeNumber >= 1) {
              countdownNumber(numberImagePixiObjects[wholeNumber - 1]);
            }
          }
        }
      }

      if (isRecording) {
        if (startedRecordingTime >= loopLengthInSeconds) {
          finishedAnimation();
          isRecording = false;
          startedRecordingTime = loopLengthInSeconds;
          onRecordDeactivateCallback(self);
        } else if (startedRecordingTime <= loopLengthInSeconds) {
          radialAnimation(0x00CA4D, startedRecordingTime, loopLengthInSeconds);
          startedRecordingTime += delta;
        }
      }

    }

    /**
     * Clear the recording circle
     */
    function clearCircle() {
      arcCircle.clear();
    }

    /**
     * Clear all recording circle tweens
     */
    function resetRecord() {
      arcCircle.clear();
      checkmarkCircle.alpha = 0;
      hideText(textImages[2], 0);
      animate.fromTo(recordIcon.scale, 0.3, {
        x: 0,
        y: 0
      }, {
        x: 1,
        y: 1
      }
      );
      for (var i = 0; i < textImages.length; i++) {
        var textImage = textImages[i];
        textImage.position.x = -205;
        textImage.position.y = 30;
      }

      container.interactive = true;
    }

    /**
     * Animate the countdown/record circle
     * @param {string} color - The color of the stroke.
     * @param {number} startedTime - The start time of the animation.
     * @param {number} duration - The duration of the recording.
     */
    function radialAnimation(color, startedTime, duration) {
      var targetRadians = (Math.PI * 2) * (startedTime / duration);

      clearCircle();
      arcCircle.moveTo(54.75, 29.75);
      arcCircle.lineStyle(10, color);
      arcCircle.arc(CIRCLE_RADIUS + 2, CIRCLE_RADIUS + 2, CIRCLE_RADIUS - 8, 0, targetRadians, false);
    }

    /**
     * Animate in the finished/checkmark circle
     */
    function finishedAnimation() {
      hideText(textImages[1], 0);
      checkmarkCircle.alpha = 1;
      mintCircle.alpha = 0;
      showText(textImages[2]);
      animate.to(checkmarkCircle.scale, 0.25, {
        x: 1,
        y: 1
      }).then(animate.to(checkmarkCircle.scale, 0.25, {
        delay: 2,
        x: 0,
        y: 0
      })
      );
      setTimeout(function(){
        resetRecord();
      }, 2100);
    }

    return self;

  };

})();
