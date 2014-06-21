module.exports = RecursorRepository;

var async = require("async");

function RecursorRepository() {}

RecursorRepository.prototype.get = function (callback) {
  var self = this;

  this._getQueue = this._getQueue || async.queue(function (task, done) {
    var callback = task.callback;

    if (!self._lock) {
      self._lock = true;
      return self._get( function (err, cursor) {
        self._lock = false;
        if (err) {callback(err); return done(); };

        callback(err, cursor);
        done();
      }.bind(self))
    } else {
      setImmediate( function () {
        self._getQueue.unshift(task);
        done();
      })
    }
  }, 1);

  this._getQueue.push({callback: callback});
}

RecursorRepository.prototype.set = function (cursor, callback) {
  var self = this;
  this._setQueue = this._setQueue || async.queue(function (task, done) {
    var cursor = task.cursor;
    var callback = task.callback;

    if (!self._lock) {
      self._lock = true;
      return self._set(cursor,  function (err, cursor) {
        self._lock = false;
        if(err) { callback(err); return done(); }

        callback(err, cursor);
        done();
      }.bind(self))
    } else {
      setImmediate( function () {
        self._setQueue.unshift(task);
        done();
      });
    }
  }, 1);

  this._setQueue.push({cursor: cursor, callback: callback});
}

/*
RecursorRepository.prototype._get = function(callback) {
  this._storage.get(callback);
}

RecursorRepository.prototype._set = function (cursor, callback) {
  this._storage.set(cursor, callback);
}
  */