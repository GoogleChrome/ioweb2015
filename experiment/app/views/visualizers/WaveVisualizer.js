var curve = require('vendor/curve_func');

module.exports = (function() {
  'use strict';

  const LINE_WIDTH = 1;
  const FFT_SIZE = 256;
  const SMOOTHING_TIME_CONSTANT = 0.3;

  /**
   * Create analyser node for wave visualisation.
   * @param {Object} audioManager - The audio manager.
   * @param {element} canvas - The canvas upon which to draw.
   * @param {array} instruments - The instruments.
   * @return {Object} self
   */
  return function WaveVisualizer(audioManager, canvas, instruments) {
    var self = {
      render,
      resize,
      init
    };

    var analysers = instruments.map(i => i.a);
    var segments = analysers.map((_, i) => 15 + ~~(25 * (1 - (i / (analysers.length - 1)))));
    var colors = instruments.map(i => `#${i.c.toString(16)}`);

    var canvasContext = canvas.getContext('2d');

    var xMax = canvas.width;
    var yMax = canvas.height;

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

        for (let j = 0; j < segments[i] + 1; j++) {
          var everyOther = j * 2;
          currentPoints[i][everyOther] = 0;
          currentPoints[i][everyOther+1] = 0;
          targetPoints[i][everyOther] = 0;
          targetPoints[i][everyOther+1] = 0;
        }
      }
    }

    /**
     * Draw oscillating wave to canvas
     */
    function drawWave() {
      canvasContext.fillStyle = 'rgba(255,255,255,0.5)';
      canvasContext.fillRect(0, 0, xMax, yMax);

      canvasContext.lineWidth = LINE_WIDTH;

      for (let i = 0; i < currentPoints.length; i++) {
        canvasContext.save();
        canvasContext.globalAlpha = 0.75;

        canvasContext.translate(0, yMax / 2);

        canvasContext.strokeStyle = colors[i];
        canvasContext.beginPath();
        curve(canvasContext, currentPoints[i], 0.5);
        canvasContext.stroke();
        canvasContext.restore();
      }
    }

    var frameWait = 1;
    var delay = frameWait;

    /**
     * On render, draw wave
     */
    function render() {
      delay--;

      if (delay > 0) {
        return;
      }

      delay = frameWait;

      getRun();
      tickChase();
      drawWave();
    }

    /**
     * Chase the target points.
     */
    function tickChase() {
      for (let i = 0; i < targetPoints.length; i++) {
        for (let j = 0; j < targetPoints[i].length; j += 2) {
          currentPoints[i][j] = targetPoints[i][j];
          currentPoints[i][j+1] += (targetPoints[i][j+1] - currentPoints[i][j+1]) * 0.3;
        }
      }
    }

    /**
     * On resize, draw wave
     */
    function resize() {
      xMax = canvas.width;
      yMax = canvas.height;

      getRun();
      tickChase();
      drawWave();
    }

    var base = 10;
    var maxAmp = Math.pow(base, 1);

    function getRun() {
      var x1 = -1;
      var x2 = xMax;

      var xs = x2 - x1;
      var baseAmp = yMax / 12;

      for (let i = 0; i < targetPoints.length; i++) {
        let stepX = xs / segments[i];
        analysers[i].getByteFrequencyData(domains[i]);

        targetPoints[i].length = 0;

        for (let j = 0; j < segments[i] + 1; j++) {
          let x = x1 + (stepX * j);

          let amplitude = domains[i][j] / 255;

          amplitude = Math.pow(base + i, amplitude) / maxAmp;

          if (amplitude <= 0.4) { amplitude = 0; }
          if (amplitude >= 1) { amplitude = 1; }

          amplitude *= (baseAmp * (i + 1));

          let y = (amplitude * (j % 2 === 0 ? 1 : -1));

          if ((j === 0) || (j === segments[i])) {
            y = 0;
          }

          var everyOther = j * 2;
          targetPoints[i][everyOther] = x;
          targetPoints[i][everyOther+1] = y;
        }
      }
    }

    return self;
  };
})();
