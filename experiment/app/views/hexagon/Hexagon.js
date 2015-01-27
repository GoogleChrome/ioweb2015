var PIXI = require('pixi.js/bin/pixi.dev.js');
var { vec2 } = require('p2');
var ColorGradient = require('toxiclibsjs/lib/toxi/color/ColorGradient');
var TColor = require('toxiclibsjs/lib/toxi/color/TColor');
var FloatRange = require('toxiclibsjs/lib/toxi/util/datatypes/FloatRange');

module.exports = (function() {
  'use strict';

  var sides = 6;
  var shades = 100;
  var range = new FloatRange(0, shades);

  var heightGradient = new ColorGradient();
  heightGradient.addColorAt(range.getAt(0), TColor.newHex('e34f4c'));
  heightGradient.addColorAt(range.getAt(0.5), TColor.newHex('ff7043'));
  heightGradient.addColorAt(range.getAt(1), TColor.newHex('ffffff'));

  var heightColors = heightGradient.calcGradient(0, shades).colors;

  var cachedTexture;

  var hexagonShadow;

  /**
   * Draw the shadow form of a Hexagon in canvas, once, and cache.
   * @param {array<array<number>>} polygon - List of points.
   * @param {number} radius - The hexagon radius.
   * @param {number} amount - The shadow depth.
   * @return {Element}
   */
  function makeHexagonShadow(polygon, radius, amount) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = (radius + amount) * 2;

    var ctx = canvas.getContext('2d');
    ctx.translate((radius + amount), (radius + amount));

    ctx.fillStyle = '#000';
    ctx.beginPath();

    for (var i = 0; i < polygon.length; i += 2) {
      var method = i === 0 ? 'moveTo' : 'lineTo';
      ctx[method](polygon[i], polygon[i+1]);
    }

    ctx.shadowColor = '#000';
    ctx.shadowBlur = amount;
    ctx.closePath();
    ctx.fill();

    return canvas;
  }

  /**
   * A single hexagon.
   * @constructor
   * @param {number} radius - The radius.
   */
  function Hexagon(radius) {
    var cube;

    var color = 0xe34f4c;
    var targetHeight = 0;

    var radRotation = (Math.PI * 2) / sides;

    var shape = makePolygon();
    var isHovering = false;

    if (!cachedTexture) {
      var textureGfx = new PIXI.Graphics();
      textureGfx.clear();
      textureGfx.lineStyle(1, 0x000000, 0.1);
      textureGfx.beginFill(0xffffff);
      textureGfx.drawShape(shape);
      textureGfx.endFill();
      cachedTexture = textureGfx.generateTexture(window.devicePixelRatio > 1.5 ? 2 : 1);
    }

    if (!hexagonShadow) {
      var shadowCanvas = makeHexagonShadow(shape.points, radius, 25);
      hexagonShadow = PIXI.Texture.fromCanvas(shadowCanvas);
    }

    var shadow = new PIXI.Sprite(hexagonShadow);
    shadow.anchor.x = shadow.anchor.y = 0.5;
    shadow.alpha = 0.8;

    var container = new PIXI.DisplayObjectContainer();
    container.addChild(shadow);

    var background = new PIXI.Sprite(cachedTexture);
    background.anchor.x = background.anchor.y = 0.5;
    container.addChild(background);

    container.hitArea = shape;

    render(0);

    var onActivateCallback;

    /**
     * Attach a callback on activation.
     * @param {function} cb - The callback.
     */
    function onActivate(cb) {
      onActivateCallback = cb;
    }

    /**
     * Attach event listeners.
     */
    function addEventListeners() {
      container.interactive = true;
      container.buttonMode = true;

      container.click = container.tap = function() {
        onActivateCallback(cube);
      };

      container.mouseover = function() {
        isHovering = true;
      };

      container.mouseout = function(){
        isHovering = false;
      };
    }

    /**
     * Detach event listeners.
     */
    function removeEventListeners() {
      container.interactive = false;
      container.buttonMode = false;
      background.tint = color;
      container.click = container.tap  = null;
    }

    /**
     * Make a polygon for a hexagon.
     * @return {PIXI.Polygon}
     */
    function makePolygon() {
      var points = [];
      var vec = vec2.fromValues(radius, 0);

      for (var i = 0; i < sides; i++) {
        var test = vec2.create();
        vec2.rotate(test, vec, radRotation * i);
        points.push(new PIXI.Point(test[0], test[1]));
      }

      return new PIXI.Polygon(points);
    }

    /**
     * Update the current color.
     * @param {number} delta - Time since last frame.
     */
    function render(delta) {
      targetHeight -= delta * 2;

      if (targetHeight < 0) { targetHeight = 0; }

      var idx = ~~(targetHeight * shades) - 1;
      if (idx < 0) { idx = 0; }

      if (idx <= 0) {
        if (isHovering) {
          background.tint = 0xC44441;
        } else {
          background.tint = color;
        }
      } else {
        background.tint = heightColors[idx].toInt();
      }

      shadow.alpha = targetHeight * 0.8;
    }

    /**
     * Activate a ripple, with optional delay.
     * @param {number=0} delay - The delay.
     */
    function activate(delay) {
      setTimeout(boostHeight, delay ? (delay * 1000) : 1);
    }

    /**
     * Bump the current height.
     */
    function boostHeight() {
      targetHeight += 1.0;

      if (targetHeight > 1.0) { targetHeight = 1.0; }

      if (container.parent) {
        container.parent.setChildIndex(container, container.parent.children.length - 1);
      }
    }

    /**
     * Set the data model for this hexagon.
     * @param {Cube} c - The cube.
     */
    function setCube(c) {
      cube = c;
    }

    return {
      container,
      activate,
      setCube,
      onActivate,
      addEventListeners,
      removeEventListeners,
      render,
      getCube: () => cube
    };
  }

  /**
   * Clear the cache on resize.
   */
  Hexagon.clearTextureCache = function() {
    cachedTexture = null;
    hexagonShadow = null;
  };

  return Hexagon;
})();
