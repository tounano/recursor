var util = require("util");
var _ = require("underscore");

var defaults = {buffer: 10};

var RecursorRepository = require("./RecursorRepository");

module.exports = BufferedRecursor;

function BufferedRecursor(inMemoryStorage, persistenceStorage, options) {
  this._options = _.defaults(defaults, options || {});
  this._bufferLength = 0;
  this._inMemoryStorage = inMemoryStorage;
  this._persistenceStorage = persistenceStorage;
}
util.inherits(BufferedRecursor, RecursorRepository);

BufferedRecursor.prototype._get = function (callback) {
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

BufferedRecursor.prototype._set = function (cursor, callback) {
  this._inMemoryStorage.set(cursor, function (err, cursor) {
    if (err) return callback(err);

    ++this._bufferLength;

    if (this._bufferLength == this._options.buffer) {
      this._bufferLength = 0;
      return this._persistenceStorage.set(cursor, callback);
    }

    callback(err, cursor);
  }.bind(this));
}