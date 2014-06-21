# recursor

Reliable cursor for MongoDB.

## The Problem

Let's say you're collecting some data and store it in MongoDB. It can be usage analytics and it can be something else.

After sometime, you have a brilliant idea. You want to add some sort of reporting system to your software. You want
to build the report based on the collected data, and you want to keep building it as we collect more data over time.

Eventually, we're talking here [Incremental Map/Reduce](http://docs.mongodb.org/manual/tutorial/perform-incremental-map-reduce/)
with one twist. Instead of processing the events in MongoDB, you'll process them in Node.

Such functionality, can be really useful for [ETL](http://en.wikipedia.org/wiki/Extract,_transform,_load) operations, or
any other operation where you need to process the event using other libraries. Like performing an HTTP Request to
external API.

## The solution

This module abstracts the process of storing and retrieving the id or some other correlation id of the last processed data unit.

The usage is really similar to the `find` method that each mongo collection exposes.

## Usage

### Installation

```
npm install recursor
```

### Usage

First let's include the module:

```js
var recursor = require("recursor");
```

The second step would be to define the persitence, in which the state will be stored. In order to do that, you have to
create an Instance of the repository object.

```js
var recursorName = "someName"; // Name your recursor... Makesure that no other recursor will use this name.
var recursorCollection = db.collection("recursorCollection");

var storage = new recursor.storage.MongoStorage(recursorName, recursorCollection);
```

Right now, the state of the `recursor` can be stored only in MongoDB. You can create new storage engines by inheriting
from the base object. More on that later.

The next step is to create an instance of `Resumer`.

```js
var eventsCollection = db.collection("events");
var resumer = new recursor.Resumer(storage, eventsCollection);
```

Now we can do our MongoDB queries as usual:

```js
resumer.resume( function (err, finder) {
  finder.find({eventName: "someEvent"}).stream().on("data", function (data) {
    console.log(data);
  };
};
```

That would be it...

From now on, the resumer would find only new added events.

### Under the hood

Basically, each time an object makes it's way out of the `finder`, it's `uniqeIndex` would be stored using `storage object`.
`uniqueIndex` must be incremental and can be configured to any value (more on that later). The default value is `{ _id: 1}`.
Which means that `_id` must be incremental.

Next time you hit the `resume` method, the `Resumer` will query for the last processed `uniqueIndex` and will query
the storage from that point.

## API

### recursor.storage.MongoStorage

This class should store the state of the `recursor` in MongoDB.

Args:

*  `recursorName` - is the name of the recursor. You can have 2 different jobs running on the same collection of events.
`recursorName` is what differentiates those 2 jobs.
*  `recursorCollection` - In which collection the state of the recursor would be stored.

Usage:

```js
var storage = new recursor.storage.MongoStorage("test job", db.collection("recursor"));
```

### recursor.Resumer

Sticks everything together. Will expose an API for resuming from the last processed event.

Args:

* `repository` - Recursor storage engine that implements the `RecursorRepository` interface.
* `collection` - The Mongo collection that has the events that are going to be processed.
* `options` - A `uniqueIndex` can be defined. Default is `{uniqueIndex: {_id: 1}}`. You can have compound index as well
such as `{uniqueIndex: {eventName: 1, timestamp: 1}}`. The only important thing to keep in mind is that `uniqueIndex`
must be incremental.

Usage:

```js
var storage = new recursor.storage.MongoStorage("test job", db.collection("recursor"));
var resumer = new recursor.resumer(storage, db.collection("events"));
```

#### resumer.resume

This method creates a `Finder` object (described bellow).

The only `Arg` of resume is a callback. Here are the args of the callback:

*  `err`
*  `finder` - an instance of a finder object.

Usage:

```js
var storage = new recursor.storage.MongoStorage("test job", db.collection("recursor"));
var resumer = new recursor.resumer(storage, db.collection("events"));

resumer.resume( function (err, finder) {
  // use finder when it's ready
};
```

### Finder

An object that has a `find` method, that you can use the same way you would with a collection.

#### finder.find

Same thing as `find` on Mongo collections, with some limitations. It's not possible to overload args the same way
as it's possible with the original method.

Args:

*  `selector` - Query/Selector as in mongo
*  `options` - Options as in Mongo

Return value: MongoDB cursor. Exactly the same thing as `collection.find()`.

Example:

```js
var storage = new recursor.storage.MongoStorage("test job", db.collection("recursor"));
var resumer = new recursor.resumer(storage, db.collection("events"));

resumer.resume( function (err, finder) {
  finder.find().nextObject( function (err, obj) {
    console.log(obj);
  };
};
```

#### Where does the magic happens?

*  `cursor.nextObject(cb)` - When you trigger this method, the `Resumer` will store a reference to this object before passing
it to (cb).
*  `cursor.stream()` - Will store a reference for each object that is being streamed. If you consume the stream slower
than it streams, the objects will be stored in a buffer. Which means that `Resumer` will still store a reference to an object
before it's being buffered.

### Extras

As you understand, for each object that would be fetched from the DB, a `recursor object` would be stored. This roundtrip
might be really expensive when you process good amount of events.

In order to make it more efficient, there are some wrappers for the storage mechanism.

#### recursor.storage.InMemoryStorage

This class implements the `RecursorRepository` interface, and stores the state in memory. Basically, InMemoryStorage
is just a helper class. Other storage objects might depend on it's instances.

#### recursor.storage.BufferedRepository

Will store the state of the recursor every 10 insertions. (or any other amount passed in opts).

Args:

*  `inMemoryStorage` - Intermediate storage. Should implement the `RecursorRepository` interface.
*  `persistenceStorage` - The final storage that the state should be persisted at.
*  `options` - Reacts to `buffer:` option. (default `{buffer: 10}`).

Example:

```js
var memory = new recursor.storage.InMemoryStorage();
var storage = new recursor.storage.MongoStorage(recursorName, recursorCollection);
var buf = new recursor.storage.BufferedRepository(memory, storage);

var resumer = new recursor.Resumer(buf, eventsCollection);
```

#### recursor.storage.TimedRepository

Will store the state of the recursor every 10 seconds. (or any other amount passed in opts).

Args:

*  `inMemoryStorage` - Intermediate storage. Should implement the `RecursorRepository` interface.
*  `persistenceStorage` - The final storage that the state should be persisted at.
*  `options` - Reacts to `saveAfter:` option. (default `{saveAfter: 10}`).

Example:

```js
var memory = new recursor.storage.InMemoryStorage();
var storage = new recursor.storage.MongoStorage(recursorName, recursorCollection);
var buf = new recursor.storage.BufferedRepository(memory, storage);
var timed = new recursor.storage.TimedRepository(buf, storage);

var resumer = new recursor.Resumer(timed, eventsCollection);
```

### Repository composition

If you want to persist the state of the recursor both every 10 insertions and every 10 seconds, you can achieve this
by passing one of the repositories as the `inMemoryStorage` of the other...

Example:

```js
var memory = new recursor.storage.InMemoryStorage();
var storage = new recursor.storage.MongoStorage(recursorName, recursorCollection);
var timed = new recursor.storage.TimedRepository(memory, storage);

var resumer = new recursor.Resumer(timed, eventsCollection);
```

## Example

Instead of using MongoDB, the example uses [TingoDB](https://github.com/sergeyksv/tingodb) which has the same API.

```js
var through = require("through");
var Engine = require("tingodb")();
var db = new Engine.Db(__dirname + '/storage',{});
db.open(function (err, db) {
  if (err)
    console.log(err);
});

// Get the collection
var collection = db.collection("events");

// Clean the collection from previous inserts
collection.remove();

collection.insert({value: "first"});
collection.insert({value: "second"});
collection.insert({value: "third"});
collection.insert({value: "forth"});

// Wait 1 second, just for the example and synchronization
setTimeout( function () {
  // Here's what's in the collection now
  collection.find().stream().pipe(through(console.log));

  // Let's process the events in the collection with recursor
  var recursor = require("recursor");

  // Set the recursor collection and let's clean it from previous
  var recursorCollection = db.collection("recursor");
  recursorCollection.remove();
  var storage = new recursor.storage.MongoStorage("exampleRecursor", recursorCollection);

  // Create the Resumer
  var resumer = new recursor.Resumer(storage, collection);

  // Resume from where we stopped
  resumer.resume(function (err, finder) {
    // Let's find all the events as we did before.
    var cursor = finder.find();

    // Let's process the 2 first events so that we'll resume from that point.
    console.log("\n\nProcessing events:");
    cursor.nextObject(function (err, obj) {
      console.log("Processing ", obj);

      // The second event
      cursor.nextObject(function (err, obj) {
        console.log("Processing ", obj);
      });
    });
  });

  // Let's say the app shuts down and we come back online after 3 seconds...
  console.log("\nShutting down...")
  setTimeout( function () {
    console.log("\nUp again, resumes from the last point...");

    // Create another instance of Resumer. We can use the previous one as well. It doesn't matter.
    var resumer2 = new recursor.Resumer(storage, collection);

    // Resume from where we stopped...
    resumer2.resume( function (err, finder) {
      finder.find().stream().pipe(through(function (data) {console.log("Processing", data)}));
    });

    // Try once again in another second
    setTimeout( function () {
      console.log("\nProcess more events...");

      // We processed all events in the collection... We should get null...
      resumer2.resume( function (err, finder) {
        finder.find().nextObject( function (err, obj) {
          if (obj === null)
            console.log("Nothing to process...");
        });
      });
    }, 1000)
  }, 3000)
}, 1000);
```

## install

With [npm](https://npmjs.org) do:

```
npm install recursor
```

## license

MIT
