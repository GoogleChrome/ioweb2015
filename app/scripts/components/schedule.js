/**
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

CDS.Schedule = (function() {

  "use strict";

  var dPR = window.devicePixelRatio;
  var card = CDS.Cards['/devsummit/schedule/'];
  var rootElement = card.getRootElement();
  var container = rootElement.querySelector('.schedule__overview-container');
  var canvas = rootElement.querySelector('canvas');
  var day1Button = rootElement.querySelector('.schedule__day-1');
  var day2Button = rootElement.querySelector('.schedule__day-2');
  var ctx = canvas.getContext('2d');

  var padding = {
    top: 82,
    bottom: 74,
    left: 16,
    right: 54
  };
  var lineOvershoot = 10;
  var rootWidth = 0;
  var rootHeight = 0;
  var labelWidth = 165;
  var availableWidth = 0;
  var availableHeight = 0;
  var selectedDay = 0;
  var today = new Date();
  var day1HitArea = {
    x: 0, y: 0,
    width: 50, height: 26
  };
  var day2HitArea = {
    x: 0, y: 0,
    width: 50, height: 26
  };

  var WHITE = '#FFF';
  var PURPLE = '#362A6C';
  var BLUE = '#4A90E2';

  var days = [{
    Breakfast: [{
      start: 8, duration: 1
    }],
    Keynote: [{
      start: 9, duration: 0.5
    },{
      start: 17, duration: 0.25
    }],
    Sessions: [{
      start: 9.5, duration: 1.5
    }, {
      start: 11.5, duration: 1.5
    },{
      start: 14.5, duration: 1.5
    },{
      start: 16.5, duration: 0.5
    }],
    Break: [{
      start: 11, duration: 0.5
    },{
      start: 13, duration: 1.5
    },{
      start: 16, duration: 0.5
    }],
    "After Party": [{
      start: 17.25, duration: 4.75
    }]
  },
  {
    Breakfast: [{
      start: 8, duration: 1.5
    }],
    Sessions: [{
      start: 9.5, duration: 2
    },{
      start: 12, duration: 1
    },{
      start: 14.25, duration: 1.75
    }],
    "Breakout Discussion": [{
      start: 16.5, duration: 1.5
    }],
    Break: [{
      start: 11.5, duration: 0.5
    },{
      start: 13, duration: 1.25
    },{
      start: 16, duration: 0.5
    }]
  }];
  var dayData = {};

  function getHoursRange(dayId) {
    var min = Number.POSITIVE_INFINITY;
    var max = Number.NEGATIVE_INFINITY;
    var day = days[dayId];
    var section, blocks, block;

    if (dayData[dayId])
      return dayData[dayId];

    var sections = Object.keys(day);
    for (var s = 0; s < sections.length; s++) {
      section = sections[s];
      for (var t = 0; t < day[section].length; t++) {
        blocks = day[section];

        for (var b = 0; b < blocks.length; b++) {
          block = blocks[b];
          if (block.start < min)
            min = block.start;
          if (block.start + block.duration > max)
            max = block.start + block.duration;
        }
      }
    }

    dayData[dayId] = {
      min: min,
      max: max
    };

    return dayData[dayId];
  }

  function onResize() {

    rootWidth = rootElement.offsetWidth;
    rootHeight = rootElement.offsetHeight;

    canvas.width = rootWidth * dPR;
    canvas.height = rootHeight * dPR;

    ctx.scale(dPR, dPR);

    canvas.style.width = rootWidth + 'px';
    canvas.style.height = rootHeight + 'px';

    availableWidth = rootWidth - labelWidth - padding.left - padding.right;
    availableHeight = rootHeight - padding.top - padding.bottom;

    day1HitArea.x = rootWidth - 136;
    day1HitArea.y = 20;

    day2HitArea.x = rootWidth - 66;
    day2HitArea.y = 20;

    draw();
  }

  function clear() {
    ctx.clearRect(0, 0, rootWidth, rootHeight);
    // ctx.fillStyle = PURPLE;
    // ctx.fillRect(padding.left + labelWidth, padding.top,
    //    availableWidth, availableHeight);
  }

  function draw() {

    clear();
    var timeRange = getHoursRange(selectedDay);
    drawLinesAndTimes(timeRange);
    drawBlocksAndLabels(timeRange);
    updateDayLabels();
  }

  function updateDayLabels() {

    if (selectedDay === 0)
      day1Button.classList.remove('schedule__day-1--inactive');
    else
      day1Button.classList.add('schedule__day-1--inactive');

    if (selectedDay === 1)
      day2Button.classList.remove('schedule__day-2--inactive');
    else
      day2Button.classList.add('schedule__day-2--inactive');
  }

  function drawLinesAndTimes(timeRange) {

    var range = timeRange.max - timeRange.min;
    var step = Math.floor(availableWidth / range);
    var x, time;
    var lineHeight = availableHeight + lineOvershoot * 2;

    ctx.save();
    ctx.translate(padding.left + labelWidth + 0.5,
        padding.top + 0.5 - lineOvershoot);
    ctx.fillStyle = '#FFF';
    ctx.strokeStyle = '#FFF';
    ctx.globalAlpha = 0.3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (var r = 0; r <= range; r++) {

      x = r * step;
      time = (timeRange.min + r) % 12;

      if (r === 0)
        time += 'AM';
      else if (time === 0)
        time = '12PM';

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, lineHeight);
      ctx.stroke();
      ctx.closePath();

      ctx.font = '500 16px/1 Roboto';
      ctx.fillText(time, x, lineHeight + 5);
    }
    ctx.restore();
  }

  function drawBlocksAndLabels(timeRange) {

    var range = timeRange.max - timeRange.min;
    var day = days[selectedDay];
    var height = 10;
    var halfHeight = height * 0.5;
    var section, blocks, block, x, y, width;
    var sections = Object.keys(day);
    var widthStep = Math.floor(availableWidth / range);
    var heightStep = (availableHeight - height) / (sections.length - 1);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.translate(padding.left, padding.top);

    for (var s = 0; s < sections.length; s++) {

      section = sections[s];
      y = Math.floor(s * heightStep);

      ctx.fillStyle = WHITE;
      ctx.globalAlpha = 0.56;
      ctx.font = '300 16px/1 Roboto';
      ctx.fillText(section, 0, y - halfHeight);

      ctx.fillStyle = BLUE;
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(labelWidth, 0);

      for (var t = 0; t < day[section].length; t++) {
        blocks = day[section];

        for (var b = 0; b < blocks.length; b++) {
          block = blocks[b];

          x = Math.floor((block.start - timeRange.min) * widthStep);
          width = Math.round(block.duration * widthStep);

          ctx.fillRect(x, y, width, height);
        }
      }

      ctx.restore();
    }

    ctx.restore();

  }

  function onDay1ButtonClick(evt) {
    evt.preventDefault();
    selectedDay = 0;
    draw();
  }

  function onDay2ButtonClick(evt) {
    evt.preventDefault();
    selectedDay = 1;
    draw();
  }

  function onExpand() {
    container.classList.add('schedule__overview-container--hidden');
  }

  function onCollapse() {
    container.classList.remove('schedule__overview-container--hidden');
  }

  function onLoad() {
    draw();
  }

  if (today.getMonth() === 10 &&
      today.getDate() === 20 &&
      today.getFullYear() === 2014) {
    selectedDay = 1;
  }

  (function init() {

    day1Button.addEventListener('click', onDay1ButtonClick);
    day2Button.addEventListener('click', onDay2ButtonClick);

    card.addEventListener('expand', onExpand);
    card.addEventListener('collapse', onCollapse);
    onResize();
    clear();
  })();

  CDS.EventPublisher.add('resize', onResize);
  CDS.EventPublisher.add('load', onLoad);

})();
