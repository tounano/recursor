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
  var recursor = require("../recursor");

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

