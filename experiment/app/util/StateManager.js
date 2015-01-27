var DataModel = require('app/util/DataModel');

module.exports = (function() {
  'use strict';

  /**
   * Central point for app-wide serializable state.
   * @constructor
   */
  return function StateManager() {
    var instruments = [];
    var instrumentLookup = {};
    var MasterDataModel;
    var allData;
    var firstLoadData;

    var self = {
      registerInstrument,
      init,
      getAllData,
      toURL,
      loadSerializedOrDefault,
      reloadFirstLoadData,
      currentData: () => allData
    };

    /**
     * Register an instrument which can be serialized.
     * @param {string} name - The name of the instrument.
     * @param {DataModel} model - The base data type.
     * @param {function} getter - The function which returns current data.
     */
    function registerInstrument(name, model, getter) {
      var descriptor = { name, model, getter };
      instruments.push(descriptor);
      instrumentLookup[name] = descriptor;
    }

    /**
     * Start-up system state.
     */
    function init() {
      var sortedInstruments = instruments.sort(function(a, b) {
        return a.name.localeCompare(b.name);
      });

      var schema = [];

      for (let i = 0; i < sortedInstruments.length; i++) {
        schema.push(sortedInstruments[i].name);
        schema.push(sortedInstruments[i].model.getRootModel());
      }

      MasterDataModel = DataModel.defineSchema('MasterModel', ...schema);
    }

    /**
     * Try to load state from the URL, or default to hard-coded initial state.
     */
    function loadSerializedOrDefault() {
      allData = null;
      var serializedData = window.location.href.match(/composition=([a-z0-9\(\)\_\.\-]+)/);

      if (serializedData) {
        var dataString = serializedData[1];

        // Returns false on bad data
        loadSerializedData(dataString);
      } else if (window.experiment && ('function' === typeof window.experiment.customData)) {
        let dataJSON = window.experiment.customData();
        loadJSONData(dataJSON);
      }

      if (!allData) {
        loadDefaultData();
      }

      firstLoadData = allData.toURL();
    }

    /**
     * Load serialized data.
     */
    function loadSerializedData(dataString) {
      allData = MasterDataModel.loadFromString(dataString);
    }

    /**
     * Load custom data.
     */
    function loadJSONData(dataJSON) {
      allData = MasterDataModel.loadFromJSON(dataJSON);
    }

    /**
     * Load custom data.
     */
    function loadDefaultData() {
      var dataModels = {};

      for (let i = 0; i < instruments.length; i++) {
        let key = instruments[i].name;
        dataModels[key] = instruments[i].model.getDefault();
      }

      allData = MasterDataModel.loadFromJSON(dataModels);
    }

    /**
     * Get current state from all instruments.
     */
    function getAllData() {
      for (var name in instrumentLookup) {
        if (instrumentLookup.hasOwnProperty(name)) {
          allData[name] = instrumentLookup[name].getter();
        }
      }
    }

    /**
     *
     */
    function reloadFirstLoadData() {
      loadSerializedData(firstLoadData);
    }

    /**
     * Output current state as a serialized string.
     */
    function toURL() {
      getAllData();
      return allData.toURL();
    }

    return self;
  };
})();
