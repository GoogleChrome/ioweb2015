var DataModel = require('app/util/DataModel');

/**
 * Defines the Guitar data model.
 */
module.exports = (function() {
  'use strict';

  // Describes a single note.
  var ParallelogramNoteModel = DataModel.defineSchema('ParallelogramNoteModel',
    'beat', Number,
    'sound', Number,
    'duration', Number,
    'pid', Number
  );

  var ParallelogramModel = DataModel.defineSchema('ParallelogramModel',
    'sound', Number,
    'color', Number,
    'hovercolor', Number
  );

  // Describes the entire data set of the instrument.
  var ParallelogramInstrumentModel = DataModel.defineSchema('ParallelogramInstrumentModel',
    'recorded', [ParallelogramNoteModel],
    'parallelograms', [ParallelogramModel]
  );

  /**
   * Returns the default state is no serialized state is available.
   * @return {Object}
   */
  function getDefault() {
    return {
      'parallelograms': [
        {
          'sound': 23,
          'color': 0xffffff,
          'hovercolor': 0xF2FBFD
        },
        {
          'sound': 24,
          'color': 0x4dd0e0,
          'hovercolor': 0x3DCCDE
        },
        {
          'sound': 25,
          'color': 0xb1eaf2,
          'hovercolor': 0x9FE6EE
        },
        {
          'sound': 21,
          'color': 0x0097a7,
          'hovercolor': 0x00A9BD
        },
        {
          'sound': 22,
          'color': 0x006064,
          'hovercolor': 0x007B85
        }
      ],
      'recorded': [
        {
          'beat': 62,
          'sound': 23,
          'duration': 5.1,
          'pid': 0
        },
        {
          'beat': 30,
          'sound': 25,
          'duration': 5.6,
          'pid': 2
        }
      ]
    };
  }

  return {
    ParallelogramNoteModel,
    ParallelogramInstrumentModel,
    getDefault,
    getRootModel: () => ParallelogramInstrumentModel
  };
})();
