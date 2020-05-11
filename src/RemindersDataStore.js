const Config = require("./Config.js");
const DataStore = require("../lib/DataStore.js");

const CACHE_PATH = Config.get().CACHE_PATH;
const DATA = new DataStore(`${CACHE_PATH}/cache/reminders.json`, {
  channelReminders: {},
});

/**
 * Get all channel IDs that have at least one reminder active
 *
 * @returns {Array<string>} channelIDs
 */
function getChannelsWithReminders() {
  const { channelReminders } = DATA.get();
  return Object.keys(channelReminders);
}

/**
 * Get all reminders set for a given channel
 *
 * @returns {Array<Object>} Reminders
 */
function getRemindersForChannel(channelID) {
  const { channelReminders } = DATA.get();
  return channelReminders[channelID] || [];
}

/**
 * Add a reminder to the given channel
 *
 * @param {string} channelID
 * @param {Object} reminder
 */
function addReminderForChannel(channelID, reminder) {
  const { channelReminders } = DATA.get();
  if (channelReminders[channelID] === undefined) {
    channelReminders[channelID] = [];
  }
  channelReminders[channelID].push(reminder);
  DATA.set({ channelReminders });
}

/**
 * Remove the reminder with the given ID from a given channel
 *
 * @param {string} channelID
 * @param {number} reminderIdx
 * @returns {?Object} True if successfully removed reminder, false if reminder index was invalid
 */
function removeReminderForChannel(channelID, reminderIdx) {
  const { channelReminders } = DATA.get();
  if (
    channelReminders[channelID] === undefined ||
    channelReminders[channelID].length <= reminderIdx
  ) {
    return null;
  }
  const reminder = channelReminders[channelID][reminderIdx];
  channelReminders[channelID].splice(reminderIdx, 1);
  if (channelReminders[channelID].length === 0) {
    delete channelReminders[channelID];
  }
  DATA.set({ channelReminders });
  return reminder;
}

module.exports = {
  getChannelsWithReminders,
  getRemindersForChannel,
  addReminderForChannel,
  removeReminderForChannel,
};
