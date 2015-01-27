module.exports = (function() {
  'use strict';

  /**
   * Creates a Metronome class which controls a dynamically
   * created webworker.
   * @constructor
   */
  return function Metronome() {
    var url = getWorkerURL();
    var worker = new Worker(url);

    /**
     * Convert the worker function to a string.
     * @return {string}
     */
    function getWorkerScript() {
      return '(' + workerInit + ')(this);';
    }

    /**
     * The body of the worker definition.
     * @param {window} global - The global scope.
     */
    function workerInit(global) {
      /* jshint worker: true, validthis: true, sub: true */
      var timerID = null;
      var interval = 100;

      var intervalFunc = 'function' === typeof setInterval ? setInterval : this['setInterval'];
      var clearIntervalFunc = 'function' === typeof clearInterval ? clearInterval : this['clearInterval'];

      function ticker() {
        postMessage('tick');
      }

      global.onmessage = function(e) {
        /* jshint sub: true */
        if (e.data === 'start') {
          timerID = intervalFunc(ticker, interval);
        } else if (e.data.interval) {
          interval = e.data.interval;
          if (timerID) {
            clearIntervalFunc(timerID);
            timerID = intervalFunc(ticker, interval);
          }
        } else if (e.data === 'stop') {
          clearIntervalFunc(timerID);
          timerID = null;
        }
      };
    }

    /**
     * Get a BLOB representation of the inline worker script.
     * @return {URL}
     */
    function getWorkerURL() {
      var blob = new Blob([getWorkerScript()], { type: 'text/javascript' });
      return URL.createObjectURL(blob);
    }

    /**
     * Kill the web worker.
     */
    function kill() {
      if (worker) {
        worker.terminate();
        worker = null;
      }

      if (url) {
        URL.revokeObjectURL(url);
        url = null;
      }
    }

    /**
     * Send a message to the worker.
     * @param {string|object} msg - The message to pass.
     */
    function post(msg) {
      if (worker) {
        worker.postMessage(msg);
      } else {
        throw 'This worker is dead.';
      }
    }

    /**
     * Start the metronome.
     */
    function start() {
      post('start');
    }

    /**
     * Stop the metronome.
     */
    function stop() {
      post('stop');
    }

    /**
     * Start the metronome speed.
     */
    function setInterval(interval) {
      post({ interval: interval });
    }

    /**
     * Subscribe to tick events.
     * @param {function} handler - The callback.
     */
    function onTick(handler) {
      if (worker) {
        worker.addEventListener('message', function(e) {
          handler(e.data);
        });
      } else {
        throw 'This worker is dead.';
      }
    }

    return {
      onTick: onTick,
      setInterval: setInterval,
      start: start,
      stop: stop,
      kill: kill
    };
  };
})();
