var floor = Math.floor;
var pow = Math.pow;

module.exports = (function() {
  'use strict';

  const LINE_WIDTH = 2;
  const FFT_SIZE = 512;
  const SMOOTHING_TIME_CONSTANT = 0.3;
  const STEPS = 7;

  var currentInstanceId = 0;

  /**
   * Create analyser node for bar visualisation.
   * @param {Object} audioManager - The audio manager.
   * @param {element} canvas - The canvas upon which to draw.
   * @param {array} instruments - The instruments.
   * @return {Object} self
   */
  return function BarVisualizer(audioManager, canvas, instruments) {
    var guid = currentInstanceId++;

    var self = {
      render,
      resize,
      init
    };

    var order = {
      'DrumView': 1,
      'ArpeggiatorView': 2,
      'HexagonView': 3,
      'GuitarView': 4,
      'ParallelogramView': 5
    };

    var analysers = instruments.sort(function(a, b) {
      return order[a.n] - order[b.n];
    }).map(i => i.a);

    var colors = instruments.map(i => `#${i.c.toString(16)}`);

    var canvasContext = canvas.getContext('2d');

    var xMax = canvas.width;
    var yMax = canvas.height;
    var segments = Math.ceil(xMax / STEPS);

    var currentPoints = [];
    var targetPoints = [];
    var domains = [];

    function init() {
      for (let i = 0; i < analysers.length; i++) {
        currentPoints[i] = [];
        targetPoints[i] = [];

        analysers[i].fftSize = FFT_SIZE;
        analysers[i].smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
        domains[i] = new Uint8Array(analysers[i].frequencyBinCount);

        for (let j = 0; j < segments + 1; j++) {
          var everyOther = j * 2;
          currentPoints[i][everyOther] = 0;
          currentPoints[i][everyOther+1] = 0;
          targetPoints[i][everyOther] = 0;
          targetPoints[i][everyOther+1] = 0;
        }
      }
    }

    /**
     * Draw oscillating bars to canvas
     */
    function drawBars() {
      canvasContext.fillStyle = 'rgba(255,255,255,1)';
      canvasContext.fillRect(0, 0, xMax, yMax);

      for (let i = 0; i < currentPoints.length; i++) {
        canvasContext.save();
        canvasContext.globalAlpha = 0.6;

        canvasContext.lineWidth = LINE_WIDTH;
        canvasContext.strokeStyle = colors[i];

        for (var j = 0; j < currentPoints[i].length; j += 2) {
          var x = currentPoints[i][j];

          if (guid % 2 !== 0) {
            x = xMax - x;
          }

          canvasContext.beginPath();
          canvasContext.moveTo(x, yMax);
          canvasContext.lineTo(x, currentPoints[i][j+1]);
          canvasContext.stroke();
        }

        canvasContext.restore();
      }
    }

    var frameWait = 1;
    var delay = frameWait;

    /**
     * On render, draw bars
     */
    function render() {
      delay--;

      if (delay > 0) {
        return;
      }

      delay = frameWait;

      getRun();
      tickChase();
      drawBars();
    }

    /**
     * On resize, draw bars
     */
    function resize() {
      xMax = canvas.width;
      yMax = canvas.height;

      segments = Math.ceil(xMax / STEPS);

      getRun();
      tickChase();
      drawBars();
    }

    /**
     * Chase the target points.
     */
    function tickChase() {
      for (let i = 0; i < targetPoints.length; i++) {
        for (let j = 0; j < targetPoints[i].length; j += 2) {
          currentPoints[i][j] = targetPoints[i][j];

          var targetY = targetPoints[i][j+1] || 0;

          currentPoints[i][j+1] = currentPoints[i][j+1] || 0;
          currentPoints[i][j+1] += (targetY - currentPoints[i][j+1]) * 0.05;
        }
      }
    }

    var base = 10;
    var maxAmp = Math.pow(base, 1);

    function getRun() {
      var baseAmp = yMax - 25;

      for (let i = 0; i < targetPoints.length; i++) {
        analysers[i].getByteFrequencyData(domains[i]);

        targetPoints[i].length = 0;

        let rightEdge = floor(analysers[i].frequencyBinCount * 0.8);

        for (let j = 0; j < segments; j++) {
          let x = (STEPS * j);

          let shiftRight = floor(STEPS * (i + 0.8) * ((xMax / STEPS) / (targetPoints.length + 0.4)));
          let shiftRightIndexes = floor(shiftRight / STEPS);

          let idx = floor((j / segments) * rightEdge);

          if (j < shiftRightIndexes) {
            let distance = shiftRightIndexes - j;
            idx = shiftRightIndexes + distance;
          } else {
            idx = idx - shiftRightIndexes;
          }

          let amplitude = (domains[i][idx] / 255);

          amplitude = pow(base, amplitude) / maxAmp;

          if (amplitude <= 0.1) { amplitude = 0; }
          if (amplitude >= 1) { amplitude = 1; }

          amplitude = (amplitude * baseAmp * 2.5);

          var everyOther = j * 2;
          targetPoints[i][everyOther] = x;
          targetPoints[i][everyOther+1] = yMax - amplitude;
        }
      }
    }

    return self;
  };
})();
