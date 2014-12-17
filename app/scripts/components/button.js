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

CDS.Button = (function() {

  "use strict";

  var buttons = document.querySelectorAll('.paper-button');
  var button, bound, x, y, ripple, size, transformString;
  var frameCount = 0;

  for (var b = 0; b < buttons.length; b++) {

    button = buttons[b];
    bound = button.getBoundingClientRect();
    size = Math.max(bound.width, bound.height) * 2;

    ripple = button.querySelector('.button__ripple');

    if (!ripple)
      continue;

    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';

    button.addEventListener('click', onClick);
  }

  function onClick(evt) {

    if (frameCount > 0)
      return;

    if (evt.currentTarget.dataset && evt.currentTarget.dataset.embed)
      CDS.VideoEmbedder.embed(evt.currentTarget);

    if (evt.currentTarget.dataset && evt.currentTarget.dataset.url)
      window.location = evt.currentTarget.dataset.url;

    frameCount = 1;
    bound = evt.currentTarget.getBoundingClientRect();
    x = Math.round(evt.clientX - bound.left);
    y = Math.round(evt.clientY - bound.top);
    transformString = 'translate(-50%, -50%) ' +
        'translate(' + x + 'px, ' + y + 'px) ' +
        'scale(0.0001, 0.0001)';

    ripple = evt.currentTarget.querySelector('.button__ripple');
    ripple.style.webkitTransform = transformString;
    ripple.style.transform = transformString;
    ripple.style.opacity = '0.4';
    ripple.classList.remove('button__ripple--animate');

    requestAnimFrame(reset);

  }

  function reset() {

    if (frameCount-- > 0) {
      requestAnimFrame(reset);
    } else {

      transformString = 'translate(-50%, -50%) ' +
          'translate(' + x + 'px, ' + y + 'px)' +
          'scale(1, 1)';

      ripple.style.webkitTransform = transformString;
      ripple.style.transform = transformString;
      ripple.style.opacity = '0';
      ripple.classList.add('button__ripple--animate');
    }
  }

})();
