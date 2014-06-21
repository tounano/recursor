module.exports = MongoStorage;

var RecursorRepository = require("../ports/RecursorRepository");
var util = require("util");
var _ = require("underscore");

function MongoStorage(recursorName, recursorCollection) {
  if (!(this instanceof MongoStorage)) return new MongoStorage(recursorName, recursorCollection);
  this._name = recursorName;
  this._recursorCollection = recursorCollection;
}
util.inherits(MongoStorage, RecursorRepository);

MongoStorage.prototype._get = function (callback) {
  return this._recursorCollection.findOne({_id: this._name}, function (err, obj) {
    if (err)
      return callback(err);

    if (obj == null || _.isUndefined(obj.cursor))
      return callback(null, {});

    callback(null, obj.cursor);
  }.bind(this));
}

MongoStorage.prototype._set = function (cursor, callback) {
  return this._recursorCollection.findAndModify({_id: this._name}, {}, {_id: this._name, cursor: cursor}, {upsert: true}, function (err, obj) {
    if (err)
      return callback(err);

    callback(null, cursor);
  }.bind(this));
}