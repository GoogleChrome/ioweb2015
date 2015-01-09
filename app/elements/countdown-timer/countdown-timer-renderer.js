IOWA.CountdownTimer.NumberRenderer = function(el) {

  this.canvas_ = el;
  this.ctx_ = this.canvas_.getContext('2d');

  this.width_ = 0;
  this.height_ = 0;
  this.drawX_ = 0;
  this.drawY_ = 0;
  this.letterPadding_ = 6;
  this.freezeDigitCount_ = 0;

  this.configureCanvas_();
  this.addEventListeners_();
};

IOWA.CountdownTimer.NumberRenderer.prototype = {

  baseNumberWidth_: 136,
  baseNumberHeight_: 140,
  measurements_: [140, 68, 97, 87, 100, 111, 116, 109, 108, 118],

  configureCanvas_: function() {

    var dPR = window.devicePixelRatio || 1;

    this.width_ = this.canvas_.parentElement.offsetWidth;
    this.height_ = this.canvas_.parentElement.offsetHeight;

    // Scale the backing store by the dPR.
    this.canvas_.width = this.width_ * dPR;
    this.canvas_.height = this.height_ * dPR;

    // Scale it back down to the width and height we want in logical pixels.
    this.canvas_.style.width = this.width_ + 'px';
    this.canvas_.style.height = this.height_ + 'px';

    // Account for any upscaling by applying a single scale transform.
    this.ctx_.scale(dPR, dPR);
  },

  addEventListeners_: function() {
    window.addEventListener('resize', this.configureCanvas_.bind(this));
  },

  measure_: function(value) {

    var metrics = {
      width: value.length * this.baseNumberWidth_,
      height: this.baseNumberHeight_
    };

    return metrics;
  },

  drawCircle_: function(color, x, y, radius) {

    if (radius < 0)
      return;

    this.ctx_.fillStyle = color;
    this.ctx_.beginPath();
    this.ctx_.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx_.closePath();
    this.ctx_.fill();
  },

  drawSemiCircle_: function(color, x, y, radius, startAngle) {

    if (radius < 0)
      return;

    this.ctx_.fillStyle = color;
    this.ctx_.beginPath();
    this.ctx_.arc(x, y, radius, startAngle, startAngle + Math.PI);
    this.ctx_.closePath();
    this.ctx_.fill();
  },

  drawRhomboid_: function(color, x, y, width, height, cornerX, cornerY) {

    if (width < 0 || height < 0)
      return;

    this.ctx_.fillStyle = color;
    this.ctx_.beginPath();

    this.ctx_.save();
    this.ctx_.translate(x, y);

    if (cornerY !== 0) {
      this.ctx_.moveTo(0, cornerY);
      this.ctx_.lineTo(width, 0);
      this.ctx_.lineTo(width, height);
      this.ctx_.lineTo(0, height + cornerY);
    } else {
      this.ctx_.moveTo(0, 0);
      this.ctx_.lineTo(width, 0);
      this.ctx_.lineTo(width + cornerX, height);
      this.ctx_.lineTo(cornerX, height);
    }

    this.ctx_.closePath();
    this.ctx_.fill();
    this.ctx_.restore();
  },

  drawBox_: function(color, x, y, width, height) {

    this.ctx_.fillStyle = color;
    this.ctx_.fillRect(x, y, width, height);

  },

  drawCover_: function(time) {

    this.ctx_.globalAlpha = (1 - time);
    this.setShadow_('', 0, 0);

    this.drawBox_(IOWA.CountdownTimer.Colors.Background,
        -this.letterPadding_,
        -this.letterPadding_,
        this.baseNumberWidth_ + this.letterPadding_ * 2,
        this.baseNumberHeight_ + this.letterPadding_ * 2);
  },

  setShadow_: function(color, blur, offsetY) {

    this.ctx_.shadowColor = color;
    this.ctx_.shadowBlur = blur;
    this.ctx_.shadowOffsetY = offsetY;
  },

  0: function(time, direction) {

    var semiCircleTopYOffset = 14;
    var semiCircleBottomYOffset = 2;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);

    // This is a tweak for the number zero just because
    // it's way bigger than the other numbers.
    this.ctx_.translate(-6, 0);

    function in_() {

      // Circle Bottom
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleBottomYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * semiCircleBottomYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.MediumBlue,
          64, 64, 64, 0);
      this.ctx_.restore();

      // Circle Top
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 14,
          time * semiCircleTopYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 64, 64, 64,
          -Math.PI);
      this.ctx_.restore();

      this.ctx_.globalAlpha = (1 - time);
      this.setShadow_('', 0, 0);
      this.drawCircle_(IOWA.CountdownTimer.Colors.Background, 64, 64, 66);

    }

    function out_() {

      var circleBottomTime = time - ((1 - time) * 1.2);

      // Circle Bottom
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * semiCircleBottomYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.MediumBlue, 64,
          64 + (1 - circleBottomTime) * 32, circleBottomTime * 64, 0);

      // Circle Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 14,
          time * semiCircleTopYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 64,
          64 - (1 - time) * 32, time * 64, -Math.PI);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;

  },

  1: function(time, direction) {

    var circleYOffset = 10;
    var rhomboidYOffset = 4;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[1]) * 0.5, 0);

    function in_() {

      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * rhomboidYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.LightBlue,
          16, 0, 40, 120, 0, 8);
      this.ctx_.restore();

      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 12, 12, 12);
      this.ctx_.restore();

      this.drawCover_(time);

    }

    function out_() {

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * rhomboidYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.LightBlue, 16,
          (1 - time) * 64, 40, time * 120, 0, 8);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 12, 12,
          time * 12);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  2: function(time, direction) {

    var circleYOffset = 10;
    var semiCircleYOffset = 2;
    var rhomboidYOffset = 4;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[2]) * 0.5, 0);

    function in_() {

      // Semi-circle
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * semiCircleYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.MediumBlue,
          34.5, 48, 48, -Math.PI * 0.5);
      this.ctx_.restore();

      // Rhomboid
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * rhomboidYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.LightBlue, 0, 94, 78,
          33, 7, 0);
      this.ctx_.restore();

      // Circle
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 12, 12, 12);
      this.ctx_.restore();

      this.drawCover_(time);
    }

    function out_() {

      var semiCircleTime = time - ((1 - time) * 1.1);
      var rhomboidTime = time - ((1 - time) * 1.05);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * semiCircleYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.MediumBlue,
          34.5 + (1 - semiCircleTime) * 24, 48,
          semiCircleTime * 48, -Math.PI * 0.5);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * rhomboidYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.LightBlue,
          (1 - rhomboidTime) * 49, 94, rhomboidTime * 78, 33, 7, 0);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 12, 12, time * 12);
    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  3: function(time, direction) {

    var circleTopYOffset = 10;
    var circleBottomYOffset = 14;
    var semiCircleTopYOffset = 6;
    var semiCircleBottomYOffset = 2;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[3]) * 0.5, 0);

    function in_() {

      // Semi-circle Bottom
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleBottomYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * semiCircleBottomYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.MediumBlue,
          34.5, 86, 42, -Math.PI * 0.5);
      this.ctx_.restore();

      // Semi-circle Top
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * semiCircleTopYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.LightBlue,
          34.5, 32, 32, -Math.PI * 0.5);
      this.ctx_.restore();

      // Circle Top
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * circleTopYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.MediumBlue,
          12, 12, time * 12);
      this.ctx_.restore();

      // Circle Bottom
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleBottomYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleBottomYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue,
          12, 116, time * 12);
      this.ctx_.restore();

      this.drawCover_(time);

    }

    function out_() {

      var semiCircleTopTime = time - ((1 - time) * 1.1);
      var semiCircleBottomTime = time - ((1 - time) * 1.05);

      // Semi-circle Bottom
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * semiCircleBottomYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.MediumBlue,
          34.5 + ((1 - semiCircleBottomTime) * 21), 86,
          semiCircleBottomTime * 42, -Math.PI * 0.5);

      // Semi-circle Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * semiCircleTopYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.LightBlue,
          34.5 + ((1 - semiCircleTopTime) * 16), 32,
          semiCircleTopTime * 32, -Math.PI * 0.5);

      // Circle Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 8,
          time * circleTopYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.MediumBlue,
          12, 12, time * 12);

      // Circle Bottom
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleBottomYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue,
          12, 116, time * 12);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  4: function(time, direction) {

    var rectangleYOffset = 2;
    var rhomboidYOffset = 12;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[4]) * 0.5, 0);

    function in_() {

      // Left rhomboid.
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * rhomboidYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.LightBlue, 0, 8,
          40, 88, 0, -8);
      this.ctx_.restore();

      // Right rectangle.
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rectangleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * rectangleYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.MediumBlue, 48, 0,
          40, 128, 0, 0);
      this.ctx_.restore();

      this.drawCover_(time);
    }

    function out_() {

      var rectangleTime = time - ((1 - time) * 1.1);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * rhomboidYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.LightBlue, 0,
          8 + (1 - time) * 44, 40, time * 88, 0, -8);

      // Right rectangle.
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * rectangleYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.MediumBlue, 48,
          (1 - rectangleTime) * 64, 40, rectangleTime * 128, 0, 0);
    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  5: function(time, direction) {

    var circleYOffset = 14;
    var semiCircleYOffset = 2;
    var rhomboidYOffset = 8;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[5]) * 0.5, 0);

    function in_() {

      // Semi-circle
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * semiCircleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * semiCircleYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.LightBlue, 51.5, 80,
          48, -Math.PI * 0.5);
      this.ctx_.restore();

      // Rhomboid
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 10,
          time * rhomboidYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.MediumBlue, 8, 0, 88, 32,
          -5, 0);
      this.ctx_.restore();

      // Circle
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 24, 53, 24);
      this.ctx_.restore();

      this.drawCover_(time);

    }

    function out_() {

      var semiCircleTime = time - ((1 - time) * 1.1);
      var rhomboidTime = time - ((1 - time) * 1.05);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * semiCircleYOffset);
      this.drawSemiCircle_(IOWA.CountdownTimer.Colors.LightBlue,
          51.5 + (1 - semiCircleTime) * 24, 80, semiCircleTime * 48,
          -Math.PI * 0.5);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 10,
          time * rhomboidYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.MediumBlue,
          8 + (1 - rhomboidTime) * 44, 0, rhomboidTime * 88, 32, -5, 0);

      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * circleYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 24, 53, time * 24);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  6: function(time, direction) {

    var circleYOffset = 4;
    var rhomboidYOffset = 8;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[6]) * 0.5, 0);

    function in_() {

      // Circle
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * circleYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.MediumBlue, 54, 80, 48);
      this.ctx_.restore();

      // Rhomboid
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * rhomboidYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.DarkBlue, 15, 0,
          40, 83, -15, 0);
      this.ctx_.restore();

      this.drawCover_(time);

    }

    function out_() {

      var circleTime = time - ((1 - time) * 1.15);

      // Circle
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 4,
          time * circleYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.MediumBlue, 54, 80,
          circleTime * 48);

      // Rhomboid
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 12,
          time * rhomboidYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.DarkBlue,
          15 + (1 - time) * 20, 0, time * 40, 83, -15, 0);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  7: function(time, direction) {

    var rhomboidTopYOffset = 8;
    var rhomboidRightYOffset = 2;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[7]) * 0.5, 0);

    function in_() {

      // Rhomboid Right
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidRightYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 2,
          time * rhomboidRightYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.MediumBlue,
          57, 6, 41, 120, -25, 0);
      this.ctx_.restore();

      // Rhomboid Top
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 12, time * rhomboidTopYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.LightBlue,
          0, 0, 77, 33, 7, 0);
      this.ctx_.restore();

      this.drawCover_(time);
    }

    function out_() {

      var rhomboidTopTime = time - ((1 - time) * 1.15);

      // Rhomboid Right
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 2, time * rhomboidRightYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.MediumBlue,
          57 + (1 - rhomboidTopTime) * 20.5, 6,
          rhomboidTopTime * 41, 120, -25, 0);

      // Rhomboid Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 12, time * rhomboidTopYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.LightBlue,
          (1 - time) * 38.5, 0, time * 77, 33, 7, 0);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  8: function(time, direction) {

    var circleTopYOffset = 14;
    var circleBottomYOffset = 1;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[8]) * 0.5, 0);

    function in_() {

      // Circle Bottom
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleBottomYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time,
          time * circleBottomYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.MediumBlue, 48, 80, 48);
      this.ctx_.restore();

      // Circle Top
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time * 14,
          time * circleTopYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 48, 36, 36);
      this.ctx_.restore();

      this.drawCover_(time);

    }

    function out_() {

      var circleBottomTime = time - ((1 - time) * 1.2);

      // Circle Bottom
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, time,
          time * circleBottomYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.MediumBlue, 48, 80,
          circleBottomTime * 48);

      // Circle Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 14, time * circleTopYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 48, 36, time * 36);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  9: function(time, direction) {

    var circleTopYOffset = 1;
    var rhomboidRightYOffset = 8;
    var circleMiddleYOffset = 16;

    this.ctx_.save();
    this.ctx_.translate(this.drawX_, this.drawY_);
    this.ctx_.translate((this.baseNumberWidth_ -
        this.measurements_[9]) * 0.5, 0);

    function in_() {

      // Circle Top
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleTopYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time, time * circleTopYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.MediumBlue, 48, 48, 48);
      this.ctx_.restore();

      // Rhomboid Right
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * rhomboidRightYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 8, time * rhomboidRightYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.LightBlue,
          65, 6, 41, 120, -25, 0);
      this.ctx_.restore();

      // Circle Middle
      this.ctx_.save();
      this.ctx_.translate(0, (1 - time) * circleMiddleYOffset);
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 12, time * circleMiddleYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 52, 64, 12);
      this.ctx_.restore();

      this.drawCover_(time);

    }

    function out_() {

      var circleTopTime = time - ((1 - time) * 1.2);

      // Circle Top
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow, circleTopTime,
          circleTopTime * circleTopYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.MediumBlue,
          48, 48, circleTopTime * 48);

      // Rhomboid Right
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 8, time * rhomboidRightYOffset);
      this.drawRhomboid_(IOWA.CountdownTimer.Colors.LightBlue,
          65 + (1 - time) * 20.5, 6, time * 41, 120, -25, 0);

      // Circle Middle
      this.setShadow_(IOWA.CountdownTimer.Colors.Shadow,
          time * 12, time * circleMiddleYOffset);
      this.drawCircle_(IOWA.CountdownTimer.Colors.DarkBlue, 52, 64, time * 12);

    }

    if (direction === IOWA.CountdownTimer.Animation.In)
      in_.call(this);
    else
      out_.call(this);

    this.ctx_.restore();
    this.drawX_ += this.baseNumberWidth_;
  },

  clear: function() {

    this.ctx_.fillStyle = IOWA.CountdownTimer.Colors.Background;
    this.ctx_.fillRect(0, 0, this.width_, this.height_);
    this.drawX_ = 0;
    this.drawY_ = 0;

  },

  draw: function(value, time, direction) {
    var valueAsString = Number(value).toString();
    var metrics = this.measure_(valueAsString);
    var characterTime = time;

    this.drawX_ = Math.round((this.width_ - metrics.width) * 0.5);
    this.drawY_ = Math.round((this.height_ - metrics.height) * 0.5);

    this.ctx_.strokeStyle = 'rgba(0,0,0,0.3)';
    this.ctx_.fillStyle = '#000';

    for (var i = 0; i < valueAsString.length; i++) {

      // Reset the time and set it to 1 if the character is frozen.
      characterTime = time;

      if (i < this.freezeDigitCount_)
        characterTime = 1;

      this.ctx_.save();
      this.ctx_.translate(this.letterPadding_, this.letterPadding_);
      this[valueAsString[i]](characterTime, direction);
      this.ctx_.restore();
    }
  },

  freeze: function(freezeCount) {
    this.freezeDigitCount_ = freezeCount;
  }
};
