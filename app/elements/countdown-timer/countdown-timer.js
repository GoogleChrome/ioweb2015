IOWA.CountdownTimer.Element = function(el) {

  this.renderer_ = new IOWA.CountdownTimer.NumberRenderer(el);

  this.currentDayCountValue_ = 0;
  this.targetDayCountValue_ = 0;
  this.targetDate_ = 0;
  this.needToFreezeDigits_ = true;

  this.timeAdjustment_ = 0;
  this.easeInTime_ = 0;
  this.waitTime_ = 0;
  this.easeOutTime_ = 0;
  this.mode_ = IOWA.CountdownTimer.Modes.Days;

  this.animationValue_ = 0;
  this.animationRunning_ = false;
  this.animationStartTime_ = 0;
  this.animationWaitStartTime_ = 0;
  this.animationEaseOutStartTime_ = 0;
  this.animationEaseOutEndTime_ = 0;

  this.drawIfAnimationIsNotRunning =
      this.drawIfAnimationIsNotRunning.bind(this);
  this.update_ = this.update_.bind(this);
  this.convertMillisecondsAndSetLabel_ =
      this.convertMillisecondsAndSetLabel_.bind(this);

  this.addEventListeners_();

};

IOWA.CountdownTimer.Element.prototype = {

  millisecondsInASecond_: 1000,
  millisecondsInAMinute_: 60 * 1000,
  millisecondsInAnHour_: 60 * 60 * 1000,
  millisecondsInADay_: 24 * 60 * 60 * 1000,

  addEventListeners_: function() {
    window.addEventListener('resize', this.drawIfAnimationIsNotRunning);
  },

  update_: function() {

    if (!this.animationRunning_)
      return;

    // Figure out where we are in the animation cycle and map it to a value
    // between 0 and 1, where 0 is the start and end state, and 1 is the
    // fully visible state on screen.
    var now = Date.now();
    var animationValue = 0;
    var animatingIn = true;
    var animationDirection = IOWA.CountdownTimer.Animation.In;

    if (now > this.animationStartTime_) {
      animationValue = (now - this.animationStartTime_) / this.easeInTime_;
    }
    if (now > this.animationWaitStartTime_) {
      animationValue = 1;

      // Ensure we only animate numbers that are changing.
      this.freezeRendererForUnchangingDigits_();
    }
    if (now > this.animationEaseOutStartTime_) {

      if (this.currentDayValue === 0)
        return;

      animationValue = 1 - ((now - this.animationEaseOutStartTime_) /
        this.easeOutTime_);
      animationDirection = IOWA.CountdownTimer.Animation.Out;
    }
    if (now > this.animationEaseOutEndTime_) {
      animationValue = 0;
    }

    // Remap the linear value through the easing equation.
    animationValue = IOWA.CountdownTimer.Easing(animationValue);

    this.renderer_.clear();
    this.renderer_.draw(this.currentDayValue, animationValue,
        animationDirection);

    if (animationValue === 0)
      this.continueAnimationIfNotAtFinalValue_();
    else
      requestAnimationFrame(this.update_);
  },

  freezeRendererForUnchangingDigits_: function() {

    if (!this.needToFreezeDigits_)
      return;

    this.needToFreezeDigits_ = false;

    var freezeCount = 0;
    var currentDayValueAsString = Number(this.currentDayValue).toString();
    var nextDayValueAsString = Number(this.getNextValue_()).toString();

    for (var i = 0; i < nextDayValueAsString.length; i++) {
      if (nextDayValueAsString[i] !== currentDayValueAsString[i])
        break;

      freezeCount++;
    }

    this.renderer_.freeze(freezeCount);
  },

  getNextValue_: function() {

    var milliseconds = this.targetDate_ - Date.now() -
        this.easeOutTime_ - this.waitTime_;

    if (milliseconds < this.millisecondsInAMinute_) {

      return this.convertMillisecondsToSeconds_(milliseconds);

    } else if (milliseconds < this.millisecondsInAnHour_) {

      return this.convertMillisecondsToMinutes_(milliseconds);

    } else if (milliseconds < this.millisecondsInADay_) {

      return this.convertMillisecondsToHours_(milliseconds);

    } else {

      return this.convertMillisecondsToDays_(milliseconds);
    }
  },

  updateAnimationTimingValues_: function() {

    this.animationStartTime_ = Date.now();
    this.animationWaitStartTime_ = this.animationStartTime_ +
        this.easeInTime_;
    this.animationEaseOutStartTime_ = this.animationWaitStartTime_ +
        this.waitTime_;
    this.animationEaseOutEndTime_ = this.animationEaseOutStartTime_ +
        this.easeOutTime_;
  },

  continueAnimationIfNotAtFinalValue_: function() {

    this.stop();

    if (this.mode === IOWA.CountdownTimer.Modes.Days)
      this.timeAdjustment_--;

    if (this.targetDate_ < Date.now())
      return;

    this.convertMillisecondsAndSetLabel_();
    this.needToFreezeDigits_ = true;

    this.updateAnimationTimingValues_();
    this.start();

  },

  start: function() {

    if (this.animationRunning_)
      return;

    this.animationRunning_ = true;
    requestAnimationFrame(this.update_);
  },

  stop: function() {
    this.animationRunning_ = false;
  },

  drawIfAnimationIsNotRunning: function() {

    if (this.animationRunning_)
      return;

    this.renderer_.clear();
    this.renderer_.draw(this.currentDayValue, 1,
        IOWA.CountdownTimer.Animation.In);

  },

  convertMillisecondsAndSetLabel_: function() {

    var millisecondsToTarget = this.targetDate_ - Date.now();

    // TODO(paullewis) Set the label for the hours, minutes, seconds
    if (millisecondsToTarget < this.millisecondsInAMinute_) {

      this.mode = IOWA.CountdownTimer.Modes.HoursMinutesSeconds;
      this.targetDayValue = 0;
      this.currentDayValue =
          this.convertMillisecondsToSeconds_(millisecondsToTarget);
      this.setLabel_("Seconds");

    } else if (millisecondsToTarget < this.millisecondsInAnHour_) {

      this.targetDayValue =
          this.convertMillisecondsToMinutes_(millisecondsToTarget);
      this.currentDayValue = this.targetDayValue + this.timeAdjustment_;
      this.setLabel_("Minutes");

    } else if (millisecondsToTarget < this.millisecondsInADay_) {

      this.targetDayValue =
          this.convertMillisecondsToHours_(millisecondsToTarget);
      this.currentDayValue = this.targetDayValue + this.timeAdjustment_;
      this.setLabel_("Hours");

    } else {

      this.targetDayValue =
          this.convertMillisecondsToDays_(millisecondsToTarget);
      this.currentDayValue = this.targetDayValue + this.timeAdjustment_;
      this.setLabel_("Days");

    }
  },

  setLabel_: function(label) {
    console.log(label);
  },

  convertMillisecondsToDays_: function(milliseconds) {
    return Math.floor(milliseconds / this.millisecondsInADay_);
  },

  convertMillisecondsToHours_: function(milliseconds) {
    return Math.floor(milliseconds / this.millisecondsInAnHour_);
  },

  convertMillisecondsToMinutes_: function(milliseconds) {
    return Math.floor(milliseconds / this.millisecondsInAMinute_);
  },

  convertMillisecondsToSeconds_: function(milliseconds) {
    return Math.floor(milliseconds / this.millisecondsInASecond_);
  },

  configure: function(options) {

    this.targetDate_ = options.targetDate.getTime();
    this.timeAdjustment_ = options.adjustmentInDays;
    this.convertMillisecondsAndSetLabel_();

    this.easeInTime_ = options.easeInTime;
    this.waitTime_ = options.waitTime;
    this.easeOutTime_ = options.easeOutTime;

    this.updateAnimationTimingValues_();
  },

  get configured() {
    return this.configured_;
  },

  get currentDayValue() {
    return this.currentDayCountValue_;
  },

  set currentDayValue(value) {
    if (value < this.targetDayValue || isNaN(value))
      value = this.targetDayValue;

    this.currentDayCountValue_ = value;
  },

  get targetDayValue() {
    return this.targetDayCountValue_;
  },

  set targetDayValue(value) {

    if (isNaN(value))
      return;

    if (value < 0)
      value = 0;

    this.targetDayCountValue_ = value;
  },

  set mode(newMode) {

    if (newMode !== IOWA.CountdownTimer.Modes.Days &&
        newMode !== IOWA.CountdownTimer.Modes.HoursMinutesSeconds)
      return;

    this.mode_ = newMode;
  },

  get mode() {
    return this.mode_;
  }

};
