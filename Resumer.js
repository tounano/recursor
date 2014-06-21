var _ = require("underscore");
var srough = require("srough");

module.exports = Resumer;

function Resumer(repository, collection, options) {
  if (!(this instanceof Resumer)) return new Resumer(repository, collection, options);
  this._options = options = options || {};
  this._options.uniqueIndex = options.uniqueIndex || {_id: 1};
  this._repository = repository;
  this._collection = collection;
}

Resumer.prototype.resume = function (callback) {
  this._repository.get(function (err, cursor) {
    if (err) return callback(err);
    callback(null, Finder(this._repository, this._collection, cursor, this._options.uniqueIndex));
  }.bind(this));
}

function Finder(repository, collection, cursorMemo, uniqueIndex) {
  var sorter = _.extend({}, uniqueIndex);

  return {
    find: function (selector, options) {
      selector = selector || {};
      options = options || {};
      options.sort = _.extend(options.sort || {}, sorter);

      var f = find(collection, cursorMemo, selector, options);
      f.nextObject = nextObjectReplacer(f.nextObject.bind(f), repository, uniqueIndex);
      f.stream = streamReplacer(f.stream.bind(f), repository, uniqueIndex);

      return f;
    }
  }
}

function nextObjectReplacer(originalNextObject, repository, uniqueIndex) {
  return function (callback) {
    originalNextObject(function (err, obj) {
      if (err) return callback(err);
      if (obj == null) return callback(null, null);

      repository.set(createRecursorDto(obj, uniqueIndex), function (err) {
        callback(null, obj);
      })
    });
  };
}

function createRecursorDto(obj, uniqueIndex) {
  return _.pick(obj, _.keys(uniqueIndex));
}

function streamReplacer(originalStream, repository, uniqueIndex) {
  return function() {
    var stream = srough(function (data, done) {
      repository.set(createRecursorDto(data, uniqueIndex), function (err) {
        this.queue(data);
        done();
      }.bind(this));
    });

    originalStream().pipe(stream);

    return stream;
  }
}

function find(collection, cursorMemo, selector, options) {
  selector = selector || {};
  _.each(cursorMemo, function (val, key) {
    selector[key] = {$gte: val};
  })

  options = _.extend({}, options || {});

  if (_.isUndefined(options.skip))
    options.skip = 0;

  if (!_.isEmpty(cursorMemo))
    ++options.skip;

  return collection.find(selector, options);
}