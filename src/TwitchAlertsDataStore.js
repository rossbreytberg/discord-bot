const config = require("../config.json");
const DataStore = require("../lib/DataStore.js");

const CACHE_DIR = config.CACHE_PATH;
const DATA = new DataStore(`${CACHE_PATH}/cache/twitch-alerts.json`);

/**
 * Add a channel to post alerts in
 *
 * @param {string} channelID
 * @returns {boolean} True if added successfully, false if it was already added
 */
function addChannel(channelID) {
  const channels = DATA.get("channels");
  if (channels.includes(channelID)) {
    return false;
  }
  channels.push(channelID);
  DATA.set("channels", channels);
  return true;
}

/**
 * Add a list message alerts sent about a user
 *
 * @param {string} userID
 * @param {Array<string>} messageIDs
 */
function addMessages(userID, messageIDs) {
  const messages = DATA.get("messages");
  if (messages[userID] === undefined) {
    messages[userID] = [];
  }
  messages[userID] = messages[userID].concat(messageIDs);
  DATA.set("messages", messages);
}

/**
 * Add a user to send alerts about them
 *
 * @param {string} username
 * @returns {boolean} True if added successfully, false if it was already added
 */
function addUser(username) {
  const users = DATA.get("users");
  if (users.includes(username)) {
    return false;
  }
  users.push(username);
  DATA.set("users", users);
  return true;
}

/**
 * Get all channels currently receiving alerts
 *
 * @returns {Array<string>} channel IDs
 */
function getChannels() {
  return DATA.get("channels");
}

/**
 * Get currently active alerts about a user
 *
 * @param {string} userID
 * @returns {Array<string>} message IDs
 */
function getMessages(userID) {
  const messages = DATA.get("messages");
  return messages[userID] || [];
}

/**
 * Get a list of users to send alerts about
 *
 * @returns {Array<string>} user IDs
 */
function getUsers() {
  return DATA.get("users");
}

/**
 * Remove a channel from getting alerts
 *
 * @param {string} channelID
 * @returns {boolean} True if removed successfully, false if was already absent
 */
function removeChannel(channelID) {
  const channels = DATA.get("channels");
  const channelIdx = channels.indexOf(channelID);
  if (channelIdx === -1) {
    return false;
  }
  DATA.set("channels", channels.splice(channelIdx, 1));
  return true;
}

/**
 * Remove list of active alerts about a user
 *
 * @param {string} userID
 */
function removeMessages(userID) {
  const messages = DATA.get("messages");
  if (messages[userID] !== undefined) {
    delete messages[userID];
  }
}

/**
 * Remove a user to stop sending alerts about them
 *
 * @param {string} username
 * @returns {boolean} True if removed successfully, false if was already absent
 */
function removeUser(username) {
  const users = DATA.get("users");
  const userIdx = users.indexOf(username);
  if (userIdx === -1) {
    return false;
  }
  DATA.set("users", users.splice(userIdx, 1));
  return true;
}

module.exports = {
  addChannel,
  addMessages,
  addUser,
  getChannels,
  getMessages,
  getUsers,
  removeChannel,
  removeMessages,
  removeUser,
};
