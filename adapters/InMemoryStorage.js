module.exports = InMemoryStorage;

var util = require("util");
var RecursorRepository = require("../ports/RecursorRepository");

function InMemoryStorage() {
  if (!(this instanceof InMemoryStorage))
    return new InMemoryStorage();
  this._cursor = {};
}
util.inherits(InMemoryStorage, RecursorRepository);

InMemoryStorage.prototype._get = function (callback) {
  callback(null, this._cursor);
}

InMemoryStorage.prototype._set = function (cursor, callback) {
  this._cursor = cursor;
  callback(null, this._cursor);
}