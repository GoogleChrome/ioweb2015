var p2 = require('p2');
var vec2 = p2.vec2;

module.exports = (function() {
  'use strict';

  const LINE_WIDTH = 6;
  const FFT_SIZE = 512;
  const SMOOTHING_TIME_CONSTANT = 0.3;
  const PARTICLE_COUNT = 100;
  const PARTICLE_SIZES = [20, 25, 30, 35, 40, 45];
  const PARTICLE_STROKE_WIDTH = 1;
  const PARTICLE_STROKE_COLOR = 'rgba(0,0,0,0.2)';

  /**
   * Create analyser node for bar visualisation.
   * @param {Object} audioManager - The audio manager.
   * @param {element} canvas - The canvas upon which to draw.
   * @param {array} instruments - The instruments.
   * @return {Object} self
   */
  return function CircleVisualizer(audioManager, canvas, instruments) {
    var self = {
      render,
      resize,
      init
    };

    var analysers = instruments.map(i => i.a);
    var colors = instruments.map(i => `#${i.c.toString(16)}`);

    var canvasContext = canvas.getContext('2d');

    var xMax = canvas.width;
    var yMax = canvas.height;

    var domains = [];
    var circles = [];
    var targetRadius = [];
    var maxAverageVolume = [];
    var particles = [];

    var baseInstrumentRadius = 80;
    var world;
    var particleImages = {};

    function init() {
      world = new p2.World();
      world.applySpringForces = false;
      world.applyDamping = false;
      world.applyGravity = false;
      world.emitImpactEvent = false;

      for (let i = 0; i < PARTICLE_SIZES.length; i++) {
        let s = PARTICLE_SIZES[i];
        particleImages[s] = cacheParticleCanvas(s);
      }

      for (let i = 0; i < analysers.length; i++) {
        analysers[i].fftSize = FFT_SIZE;
        analysers[i].smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
        domains[i] = new Uint8Array(analysers[i].frequencyBinCount);

        var circleBody = new p2.Body({
          position: [0, 0],
          mass: 0,
          angularVelocity: 10
        });

        circleBody.circleShape = new p2.Circle(baseInstrumentRadius);
        circleBody.addShape(circleBody.circleShape);

        circles.push(circleBody);
      }

      resize();

      for (let i = 0; i < circles.length; i++) {
        world.addBody(circles[i]);
      }

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let randomX = Math.random() * 1000;
        let randomY = -100;

        var particleBody = new p2.Body({
          position: [randomX, randomY],
          mass: 1,
          angularVelocity: 10
        });

        particleBody.isParticle = true;

        let radius = PARTICLE_SIZES[i % PARTICLE_SIZES.length];
        particleBody.circleShape = new p2.Circle(radius);
        particleBody.addShape(particleBody.circleShape);

        particles.push(particleBody);
        world.addBody(particleBody);
      }
    }

    var positionValues = [
      [0.25, 0.6],
      [0.05, 0.05],
      [0.55, 0.4],
      [0.8, 0.8],
      [0.95, 0.1]
    ];

    function positionInstrumentCircles() {
      baseInstrumentRadius = (xMax / (circles.length * 20)) + LINE_WIDTH;

      for (let i = 0; i < circles.length; i++) {
        circles[i].position[0] = (xMax * positionValues[i][0]) - (xMax / 2);
        circles[i].position[1] = (yMax * positionValues[i][1]) - (yMax / 2);
        targetRadius[i] = baseInstrumentRadius;
      }
    }

    function cacheParticleCanvas(radius) {
      var particleCanvas = document.createElement('canvas');
      particleCanvas.width = ((radius + PARTICLE_STROKE_WIDTH) * 2);
      particleCanvas.height = ((radius + PARTICLE_STROKE_WIDTH) * 2);

      var particleContext = particleCanvas.getContext('2d');
      particleContext.lineWidth = PARTICLE_STROKE_WIDTH;
      particleContext.strokeStyle = PARTICLE_STROKE_COLOR;

      particleContext.beginPath();
      particleContext.arc(
        radius + PARTICLE_STROKE_WIDTH,
        radius + PARTICLE_STROKE_WIDTH,
        radius,
        0,
        Math.PI * 2
      );
      particleContext.stroke();

      return particleCanvas;
    }

    /**
     * Draw oscillating wave to canvas
     */
    function drawCircles() {
      canvasContext.fillStyle = 'white';
      canvasContext.fillRect(0, 0, xMax, yMax);

      for (let i = 0; i < particles.length; i++) {
        let r = particles[i].circleShape.radius;
        canvasContext.drawImage(
          particleImages[r],
          particles[i].position[0] - r + (xMax / 2),
          particles[i].position[1] - r + (yMax / 2)
        );
      }

      for (let i = 0; i < circles.length; i++) {
        canvasContext.save();

        canvasContext.lineWidth = LINE_WIDTH;
        canvasContext.strokeStyle = colors[i];

        canvasContext.beginPath();

        canvasContext.arc(
          circles[i].position[0] + (xMax / 2),
          circles[i].position[1] + (yMax / 2),
          circles[i].circleShape.radius,
          0,
          Math.PI * 2
        );
        canvasContext.stroke();
        canvasContext.fill();

        canvasContext.restore();
      }
    }

    var frameWait = 1;
    var delay = frameWait;

    /**
     * On render, draw wave
     */
    function render(delta) {
      delay--;

      if (delay > 0) {
        return;
      }

      delay = frameWait;

      getRun();
      tickChase();
      stepPhysics(delta);
      drawCircles();
    }

    function stepPhysics(delta) {
      attractParticles(delta);

      world.step(1 / 60);
    }

    var force = vec2.create();

    function attractParticles(delta) {
      var gravity = 4000;

      for (let j = 0; j < circles.length; j++) {
        var circle = circles[j];

        for (let i = 0; i < particles.length; i++) {
          attract(gravity, delta, circle, particles[i]);
        }
      }
    }

    function attract(amount, delta, attractor, particle) {
      var attractorPos = attractor.position;
      var particlePos = particle.position;

      vec2.subtract(force, attractorPos, particlePos);
      var distance = Math.min(vec2.length(force), 10);

      vec2.normalize(force, force);

      var strength = delta * (amount / (distance));
      vec2.scale(force, force, strength);

      vec2.add(particle.velocity, particle.velocity, force);
    }

    /**
     * Chase the target points.
     */
    function tickChase() {
      for (let i = 0; i < circles.length; i++) {
        targetRadius[i] = targetRadius[i] || baseInstrumentRadius;
        circles[i].circleShape.radius += (targetRadius[i] - circles[i].circleShape.radius) * 0.08;
      }
    }

    /**
     * On resize, draw wave
     */
    function resize() {
      xMax = canvas.width;
      yMax = canvas.height;

      positionInstrumentCircles();

      getRun();
      tickChase();
      drawCircles();
    }

    function getRun() {
      for (let i = 0; i < circles.length; i++) {
        analysers[i].getByteFrequencyData(domains[i]);

        let averageVolume = getHighestVolume(domains[i]);

        if (!maxAverageVolume[i] || (averageVolume > maxAverageVolume[i])) {
          maxAverageVolume[i] = averageVolume;
        }

        let amplitude = (averageVolume / maxAverageVolume[i]);

        if (isNaN(amplitude)) { amplitude = 0; }
        if (amplitude <= 0) { amplitude = 0; }
        if (amplitude >= 1) { amplitude = 1; }

        targetRadius[i] = baseInstrumentRadius + (amplitude * baseInstrumentRadius * 8);
      }
    }

    function getHighestVolume(array) {
      var values = 0;

      for (let i = 0; i < array.length; i++) {
        values += array[i];
      }

      return values / array.length;
    }

    return self;
  };
})();
