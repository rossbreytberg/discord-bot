const QuoteCommands = require("./QuoteCommands.js");
const RemindersCommands = require("./RemindersCommands.js");
const TwitchCommands = require("./TwitchCommands.js");

module.exports = {
  quote: QuoteCommands,
  reminders: RemindersCommands,
  twitch: TwitchCommands,
};
