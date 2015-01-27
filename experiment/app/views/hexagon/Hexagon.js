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
    // ctx.shadowOffsetX = 15;
    // ctx.shadowOffsetY = 15;
    ctx.closePath();
    ctx.fill();

    return canvas;
  }

  var hexagonShadow;

  function Hexagon(radius) {
    var cube;

    var color = 0xe34f4c;
    var currentColor = color;

    var radRotation = (Math.PI * 2) / sides;

    var shape = makePolygon();

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

    var background = new PIXI.Sprite(cachedTexture);
    background.anchor.x = background.anchor.y = 0.5;
    container.addChild(background);

    container.hitArea = shape;

    var tweenData = { height: 0 };

    render();

    var onActivateCallback;
    function onActivate(cb) {
      onActivateCallback = cb;
    }

    function addEventListeners() {
      container.interactive = true;
      container.buttonMode = true;

      container.click = container.tap = function() {
        onActivateCallback(cube);
      };

      container.mouseover = function(){
        background.tint = 0xC44441;
      };

      container.mouseout = function(){
        background.tint = color;
      };
    }

    function removeEventListeners() {
      container.interactive = false;
      container.buttonMode = false;
      background.tint = color;
      container.click = container.tap  = null;
    }

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

    function render() {
      background.tint = currentColor;
    }

    function updateColor(c) {
      currentColor = c;
      render();
    }

    var currentTween;
    var tweenTo = { height: 0, onUpdate: onUpdate, ease: Expo.easeOut,
      onComplete: function() {
        currentTween = null;
        container.removeChild(shadow);
      },
      onStart: function() {
        shadow.alpha = 0;
        container.addChildAt(shadow, 0);
      }
    };

    function activate(delay) {
      if (currentTween) {
        currentTween.kill();
        container.removeChild(shadow);
      }

      tweenData.height = 1;
      tweenTo.delay = delay || 0;
      container.parent.setChildIndex(container, container.parent.children.length-1);
      currentTween = TweenMax.to(tweenData, 1.4, tweenTo);
    }

    function onUpdate() {
      var idx = ~~(tweenData.height * shades) - 1;
      if (idx < 0) { idx = 0; }
      updateColor(heightColors[idx].toInt());
      shadow.alpha = tweenData.height * 0.8;
    }

    function setCube(c) {
      cube = c;
    }

    return {
      container,
      updateColor,
      activate,
      setCube,
      onActivate,
      addEventListeners,
      removeEventListeners,
      getCube: () => cube
    };
  }

  Hexagon.clearTextureCache = function() {
    cachedTexture = null;
    hexagonShadow = null;
  };

  return Hexagon;
})();
