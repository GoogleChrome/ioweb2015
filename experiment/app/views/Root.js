var PIXI = require('pixi.js/bin/pixi.dev.js');
var reqAnimFrame = require('app/util/raf');
var { Promise } = require('es6-promise');
var throttle = require('lodash.throttle');
var debounce = require('lodash.debounce');
var currentViewportDetails = require('app/util/currentViewportDetails');

var MaskManager = require('app/views/shared/MaskManager');

// All defined instruments
var VisualizerContainer = require('app/views/VisualizerContainer');
var BarVisualizer = require('app/views/visualizers/BarVisualizer');
var WaveVisualizer = require('app/views/visualizers/WaveVisualizer');
var CircleVisualizer = require('app/views/visualizers/CircleVisualizer');

var InstrumentContainer = require('app/views/InstrumentContainer');
var ParallelogramView = require('app/views/ParallelogramView');
var DrumView = require('app/views/DrumView');
var GuitarView = require('app/views/GuitarView');
var ArpeggiatorView = require('app/views/ArpeggiatorView');
var HexagonView = require('app/views/HexagonView');

var logoSrc = require('url?limit=10000!app/images/io_white.png');

module.exports = function(audioManager, stateManager) {
  'use strict';

  var instrumentElements;
  var visualizerElements;
  var viewportElement;
  var logoElement;
  var logoDialog;
  var instrumentViews = [];
  var visualizerViews = [];
  var lastFrame = 0;
  var isPaused = false;
  var pauseAfterFrame = false;
  var isExpanded = false;

  var onWindowResize = throttle(onWindowResizeUnThrottled, 200);
  var onWindowScrollStart = debounce(onWindowScrollStartUnDebounced, 250, { leading: true, trailing: false });
  var onWindowScrollStop = debounce(onWindowScrollStopUnDebounced, 250, { leading: false, trailing: true });
  var continueAnimating = true;

  var containerElem = document.querySelector('#content-container') || document.body;

  var didEnterRecordingModeCallback;
  var didExitRecordingModeCallback;

  var self = {
    init,
    start,
    stop,
    animateIn,
    animateOut,
    cleanUp,
    didEnterRecordingMode,
    didExitRecordingMode,
    reloadData
  };

  var maskManager = new MaskManager('experiment-is-masked');

  /**
   * Initialize the view and start the central rAF loop.
   * @param {string} instrumentSelector - DOM element for instruments
   * @param {string} visualizerSelector - DOM element for visualizers
   */
  function init(instrumentSelector, visualizerSelector) {
    viewportElement = document.createElement('div');
    viewportElement.classList.add('experiment-viewport');

    logoElement = document.createElement('div');
    logoElement.classList.add('experiment-logo', 'hidden');
    logoElement.style.backgroundImage = 'url('+logoSrc+')';
    logoElement.title = 'Click to return to I/O website';

    logoDialog = document.createElement('div');
    logoDialog.classList.add('logo-dialog');
    logoDialog.insertAdjacentHTML('beforeend',
      '<h4>Exit the Experiment?</h4><div class="button-container"><button id="noButton">Cancel</button><button id="yesButton">Yes</button></div>');

    maskManager.init(viewportElement);

    lastFrame = performance.now();

    instrumentElements = Array.prototype.slice.call(document.querySelectorAll(instrumentSelector), 0);
    visualizerElements = Array.prototype.slice.call(document.querySelectorAll(visualizerSelector), 0);

    instrumentViews = createInstrumentContainers();
    visualizerViews = createVisualizerContainers();

    var instrumentData = [];
    for (let i = 0; i < instrumentViews.length; i++) {
      stateManager.registerInstrument(
        instrumentViews[i].getView().name,
        instrumentViews[i].getView().dataModel,
        instrumentViews[i].getView().getData
      );

      instrumentData.push(instrumentViews[i].getView().name);
      instrumentData.push(instrumentViews[i].getView().dataModel);
    }
  }

  /**
   * Initialize the view and start the central rAF loop.
   */
  function start() {
    PIXI.AUTO_PREVENT_DEFAULT = false;

    window.addEventListener('resize', onWindowResize);
    onWindowResize();

    var scrollElement = currentViewportDetails().scrollElement;
    scrollElement.addEventListener('scroll', onWindowScrollStart);
    scrollElement.addEventListener('scroll', onWindowScrollStop);

    loadData();

    viewportElement.appendChild(logoElement);
    viewportElement.appendChild(logoDialog);

    containerElem.style.position = 'relative';
    containerElem.appendChild(viewportElement);

    logoClick();
    dialogClick();
  }

  /**
   * Load the global state into each view.
   */
  function loadData() {
    for (let i = 0; i < instrumentViews.length; i++) {
      let v = instrumentViews[i].getView();
      v.loadData(stateManager.currentData()[v.name]);
    }
  }

  /**
   * Reload the initial global state into each view.
   */
  function reloadData() {
    stateManager.reloadFirstLoadData();
    loadData();
  }

  /**
   * Pause animations.
   */
  function stop() {
    continueAnimating = false;
    window.removeEventListener('resize', onWindowResize);

    var scrollElement = currentViewportDetails().scrollElement;
    scrollElement.removeEventListener('scroll', onWindowScrollStart);
    scrollElement.removeEventListener('scroll', onWindowScrollStop);
  }

  /**
   * Animate experiment in from fab.
   * @param {array} [x, y] - the x and y position to animate from.
   */
  function animateIn([x, y]) {
    animate();

    disableScrolling();

    return maskManager.animateIn(x, y).then(function() {
      isPaused = false;
      enableScrolling();
      logoElement.classList.remove('hidden');
    });
  }

  /**
   * Animate experiment out to fab.
   * @param {array} [x, y] - the x and y position to animate toward.
   */
  function animateOut([x, y]) {
    disableScrolling();

    return maskManager.animateOut(x, y).then(function() {
      stop();
      enableScrolling();
    });
  }

  /**
   * Remove experiment viewport element.
   */
  function cleanUp() {
    viewportElement.parentNode.removeChild(viewportElement);
    viewportElement = null;

    containerElem.style.position = '';
  }

  /**
   * Figure out which instrument view replaces which DOM element.
   * @param {Element} elem - The element.
   * @param {number} pid - The unique ID.
   * @return {Object}
   */
  function getInstrumentForElem(elem, pid) {
    if (pid === 4) {
      return ArpeggiatorView;
    } if (pid === 3) {
      return HexagonView;
    } else if (pid === 2) {
      return DrumView;
    } else if (pid === 1) {
      return ParallelogramView;
    } else if (pid === 0) {
      return GuitarView;
    }
  }

  /**
   * Figure out which visualizer view replaces which DOM element.
   * @param {Element} elem - The element.
   * @param {number} pid - The unique ID.
   * @return {Object}
   */
  function getVisualizerForElem(elem, pid) {
    if (pid === 0) {
      return [WaveVisualizer, instrumentViews[0]];
    } else if (pid === 1 || pid === 2) {
      return [BarVisualizer, instrumentViews[2]];
    } else if (pid === 3) {
      return [CircleVisualizer, instrumentViews[3]];
    }
  }

  /**
   * Map instruments to DOM elements.
   * @return {array<InstrumentContainer>}
   */
  function createInstrumentContainers() {
    var views = [];

    instrumentElements.forEach(function(elem, i) {
      var instrumentView = new InstrumentContainer(audioManager, elem, viewportElement);
      var instrument = getInstrumentForElem(elem, i);

      if (instrument) {
        instrumentView.init(i, instrument); // TODO: Use guid?
        instrumentView.onActivate(openView);
        instrumentView.onBack(closeView);
        views.push(instrumentView);
      }
    });

    return views;
  }

  /**
   * Map visualizers to DOM elements.
   * @return {array<VisualizerContainer>}
   */
  function createVisualizerContainers() {
    return visualizerElements.map(function(elem, i) {
      var pixiObject = new VisualizerContainer(audioManager, elem, viewportElement, instrumentViews.map(function(i) { return { a: i.getChannel().analyser, c: i.getView().backgroundColor, n: i.getView().name }; }));
      var visualizer = getVisualizerForElem(elem, i);
      if (visualizer) {
        pixiObject.init(i, visualizer[0]); // TODO: Use guid?
      }
      return pixiObject;
    });
  }

  /**
   * rAF loop.
   * @param {number} ts - The current timestamp.
   */
  function animate(ts) {
    if (!continueAnimating) { return; }

    var now = ts || performance.now();
    var delta = now - lastFrame;
    lastFrame = now;

    if ((delta > 200) || (delta <= 0)) {
      delta = 16;
    }

    reqAnimFrame(animate);

    if (!isPaused) {
      var secDelta = delta / 1000;
      audioManager.render(secDelta);
      renderChildren(secDelta);
    }

    if (pauseAfterFrame === 1) {
      isPaused = true;
      pauseAfterFrame = false;
    } else {
      pauseAfterFrame--;
    }
  }

  /**
   * Tick all child views.
   * @param {number} delta - The time since last frame.
   */
  function renderChildren(delta) {
    for (var i = 0; i < instrumentViews.length; i++) {
      instrumentViews[i].render(delta);
    }

    for (var j = 0; j < visualizerViews.length; j++) {
      visualizerViews[j].render(delta);
    }
  }

  /**
   * Attach a callback for entering recording mode.
   * @param {function} cb - The callback.
   */
  function didEnterRecordingMode(cb) {
    didEnterRecordingModeCallback = cb;
  }

  /**
   * Attach a callback for exiting recording mode.
   * @param {function} cb - The callback.
   */
  function didExitRecordingMode(cb) {
    didExitRecordingModeCallback = cb;
  }

  /**
   * Expand a view.
   * @param {InstrumentContainer} view - The instrument view.
   * @return {Promise}
   */
  function openView(view) {
    isExpanded = true;
    PIXI.AUTO_PREVENT_DEFAULT = true;

    if (didEnterRecordingModeCallback) {
      didEnterRecordingModeCallback();
    }

    disableScrolling();

    audioManager.channels.muteAllExcept(view.getChannel());

    logoElement.classList.add('hidden');
    logoDialog.classList.remove('active');

    return Promise.all([
      hideOnScreenVisualizers(view),
      view.expandView()
    ]).then(function() {
      disableAllInstancesExcept(view);
    });
  }

  /**
   * Contract a view.
   * @param {InstrumentContainer} view - The instrument view.
   * @return {Promise}
   */
  function closeView(view) {
    enableAllInstancesInsideViewport();
    PIXI.AUTO_PREVENT_DEFAULT = false;

    if (didExitRecordingModeCallback) {
      didExitRecordingModeCallback();
    }

    logoElement.classList.remove('hidden');

    return Promise.all([
      showOnScreenVisualizers(),
      view.contractView()
    ]).then(function() {
      enableScrolling();
      isExpanded = false;
      audioManager.channels.unmuteAllExcept(view.getChannel());
    });
  }

  /**
   * Add click handler to IO logo
   */
  function logoClick() {
    logoElement.addEventListener('click', function() {
      logoDialog.classList.toggle('active');
    });
  }

  /**
   * Add click handlers to yes/no buttons
   */
  function dialogClick() {
    var experimentFab = document.querySelector('experiment-fab-container');
    document.getElementById('yesButton').addEventListener('click', function() {
      logoElement.parentNode.removeChild(logoElement);
      logoDialog.parentNode.removeChild(logoDialog);
      experimentFab.exitExperiment();
    });
    document.getElementById('noButton').addEventListener('click', function() {
      logoDialog.classList.remove('active');
    });
  }

  /**
   * Is the visualizer currently on screen?
   * @param {Object} visualizerView - The visualizer view
   * @return {boolean}
   */
  function isVisualizerOnScreen(visualizerView) {
    var { top, height } = visualizerView.getElemRect();

    var visualizerTop = top;
    var visualizerBottom = visualizerTop + height;

    var scrollTop = currentViewportDetails().y;
    var scrollBottom = scrollTop + window.innerHeight;

    return (
      (visualizerBottom >= scrollTop) &&
      (visualizerTop <= scrollBottom)
    );
  }

  /**
   * Hide current on screen visualizer
   * @param {InstrumentContainer} openingView - The opening view.
   * @param {Object} visualizerView - The visualizer view
   * @return {function}
   */
  function hideOnScreenVisualizer(openingView, visualizerView) {
    var scrollY = currentViewportDetails().y;

    var screenBottom = scrollY + window.innerHeight;
    var screenMidPoint = scrollY + (window.innerHeight / 2);

    var openingRect = openingView.getElemRect();
    var openingViewBottom = openingRect.top + openingRect.height;

    var visualizerRect = visualizerView.getElemRect();
    var visualizerBottom = visualizerRect.top + visualizerRect.height;
    var viewMidPoint = visualizerRect.top + (visualizerRect.height / 2);
    var closestDirection = viewMidPoint < screenMidPoint ? 'top' : 'bottom';

    var entirelyInView = (
      (visualizerRect.top >= scrollY) &&
      (visualizerBottom <= screenBottom)
    );

    var direction;
    if (!entirelyInView) {
      direction = closestDirection;
    } else if ((openingRect.top <= scrollY) && (openingViewBottom <= screenBottom)) {
      direction = 'bottom';
    } else if ((openingRect.top > scrollY) && (openingViewBottom > screenBottom)) {
      direction = 'top';
    } else {
      direction = closestDirection;
    }

    return visualizerView.hide(direction);
  }

  /**
   * Hide on screen visualizers
   * @param {InstrumentContainer} view - The opening view.
   * @return {Promise}
   */
  function hideOnScreenVisualizers(view) {
    var animations = visualizerViews
        .filter(isVisualizerOnScreen)
        .map(v => hideOnScreenVisualizer(view, v));

    return Promise.all(animations);
  }

  /**
   * Show on screen visualizers
   * @return {Promise}
   */
  function showOnScreenVisualizers() {
    var animations = visualizerViews
        .filter(v => v.isHidden())
        .map(v => v.show());

    return Promise.all(animations);
  }

  /**
   * Helper to kill all DOM events.
   * @param {Event} e - The DOM event.
   * @return {boolean}
   */
  function killEvents(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  /**
   * Disable scrolling.
   */
  function disableScrolling() {
    var scrollElement = currentViewportDetails().scrollElement;
    scrollElement.addEventListener('scroll', killEvents);
    window.addEventListener('mousewheel', killEvents);
    window.addEventListener('touchmove', killEvents);
  }

  /**
   * Enable scrolling.
   */
  function enableScrolling() {
    var scrollElement = currentViewportDetails().scrollElement;
    scrollElement.removeEventListener('scroll', killEvents);
    window.removeEventListener('mousewheel', killEvents);
    window.removeEventListener('touchmove', killEvents);
  }

  /**
   * Global resize event.
   */
  function onWindowResizeUnThrottled() {
    var w = window.innerWidth;
    var h = window.innerHeight;

    viewportElement.style.height = `${currentViewportDetails().height}px`;

    for (var i = 0; i < instrumentViews.length; i++) {
      instrumentViews[i].resize(w, h);
    }

    for (var j = 0; j < visualizerViews.length; j++) {
      visualizerViews[j].resize(w, h);
    }

    onWindowScrollStop();
  }

  /**
   * When scrolling starts.
   */
  function onWindowScrollStartUnDebounced() {
    if (isExpanded) { return; }

    enableAllInstances();

    instrumentViews.forEach(e => e.ignoreInteraction());
  }

  /**
   * When scrolling stops.
   */
  function onWindowScrollStopUnDebounced() {
    if (isExpanded) { return; }

    disableViewsOutsideViewport();

    instrumentViews.forEach(e => e.followInteraction());
  }

  /**
   * Disable all views, except one.
   * @param {InstrumentContainer} view - The view.
   */
  function disableAllInstancesExcept(view) {
    instrumentViews
      .filter(e => e !== view)
      .forEach(e => e.disable());
    visualizerViews.forEach(e => e.disable());
  }

  /**
   * Enable all views.
   */
  function enableAllInstances() {
    instrumentViews.forEach(e => e.enable());
    visualizerViews.forEach(e => e.enable());
  }

  /**
   * Check if a view is in the viewport.
   * @param {InstrumentContainer} view - The view.
   * @return {boolean}
   */
  function isInViewport(view) {
    var top = currentViewportDetails().y;
    var bottom = top + window.innerHeight;
    var rect = view.getElemRect();
    var inView = (rect.top <= bottom) && ((rect.top + rect.height) >= top);

    return inView;
  }

  /**
   * Enable instruments that are visible.
   */
  function enableAllInstancesInsideViewport() {
    instrumentViews
      .filter(e => isInViewport(e))
      .forEach(e => e.enable());

    visualizerViews
      .filter(e => isInViewport(e))
      .forEach(e => e.enable());
  }

  /**
   * Disables instruments that are not visible.
   */
  function disableViewsOutsideViewport() {
    instrumentViews
      .filter(e => !isInViewport(e))
      .forEach(e => e.disable());

    visualizerViews
      .filter(e => !isInViewport(e))
      .forEach(e => e.disable());
  }

  return self;
};
