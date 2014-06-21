var util = require("util");
var _ = require("underscore");

var defaults = {saveAfter: 10}

var RecursorRepository = require("./RecursorRepository");

module.exports = TimedRepository;

function TimedRepository(inMemoryStorage, persistenceStorage, options) {
  this._options = _.defaults(defaults, options || {});
  this._isDirty = false;
  this._scheduledSave = false;
  this._inMemoryStorage = inMemoryStorage;
  this._persistenceStorage = persistenceStorage;
}
util.inherits(TimedRepository, RecursorRepository);

TimedRepository.prototype._get = function (callback) {
  this._inMemoryStorage.get(function (err, cursor) {
    if (_.isEmpty(cursor)) {
      return this._persistenceStorage.get( function (err, cursor) {
        if (err) return callback(err);

        this._inMemoryStorage.set(cursor, callback);
      }.bind(this));
    }

    callback(err, cursor);
  }.bind(this));
}

TimedRepository.prototype._set =  function (cursor, callback) {
  this._inMemoryStorage.set(cursor, function (err, obj) {
    if (err) return callback(err);

    this._isDirty = true;

    if (this._isDirty && !this._scheduledSave) {
      this._scheduledSave = true;
      setTimeout( function () {
        this._scheduledSave = false;
        this._inMemoryStorage.get(function (err, cursor) {
          if (err) return;
          this._persistenceStorage.set(cursor, function (err, cursor) {
            if (err) return;
            this._isDirty = false;
          }.bind(this))
        }.bind(this));
      }.bind(this), this._options.saveAfter * 1000);
    }

    callback(err, obj);
  }.bind(this));
}