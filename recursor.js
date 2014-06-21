exports.Resumer = require("./Resumer");
exports.storage = {
  MongoStorage: require("./adapters/MongoStorage"),
  InMemoryStorage: require("./adapters/InMemoryStorage"),
  BufferedRepository: require("./ports/BufferedRecursor"),
  TimedRepository: require("./ports/TimedRepository")
}
exports.abstract = {
  RecursorRepository: require("./ports/RecursorRepository")
}