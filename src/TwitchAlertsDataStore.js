const Config = require("./Config.js");
const DataStore = require("../lib/DataStore.js");

const CACHE_PATH = Config.get().CACHE_PATH;
const DATA = new DataStore(`${CACHE_PATH}/cache/twitch-alerts.json`);

/**
 * Get all users about which any channel is receiving alerts
 *
 * @returns {Array<string>} usernames
 */
function getUsers() {
  const channelUsers = DATA.get("channelUsers");
  const userSet = {};
  Object.keys(channelUsers).forEach(channelID => {
    getUsersForChannel(channelID).forEach(username => {
      userSet[username] = true;
    });
  });
  return Object.keys(userSet);
}

/**
 * Get all users about which this channel is receiving alerts
 *
 * @returns {Array<string>} usernames
 */
function getUsersForChannel(channelID) {
  const channelUsers = DATA.get("channelUsers");
  return channelUsers[channelID] || [];
}

/**
 * Get all channels receiving alerts about this user
 *
 * @returns {Array<string>} channel IDs
 */
function getChannelsForUser(username) {
  const channelUsers = DATA.get("channelUsers");
  return Object.keys(channelUsers).filter(channelID =>
    getUsersForChannel(channelID).includes(username),
  );
}

/**
 * Subscribe a channel to receive alerts about a user
 *
 * @param {string} channelID
 * @param {string} username
 * @returns {boolean} True if subscribed successfully, false if it was already subscribed
 */
function subscribeChannelToUser(channelID, username) {
  const channelUsers = DATA.get("channelUsers");
  if (channelUsers[channelID] === undefined) {
    channelUsers[channelID] = [];
  }
  if (channelUsers[channelID].includes(username)) {
    return false;
  }
  channelUsers[channelID].push(username);
  DATA.set("channelUsers", channelUsers);
  return true;
}

/**
 * Unsubscribe a channel to stop receiving alerts about a user
 *
 * @param {string} channelID
 * @param {string} username
 * @returns {boolean} True if unsubscribed successfully, false if it was already not subscribed
 */
function unsubscribeChannelToUser(channelID, username) {
  const channelUsers = DATA.get("channelUsers");
  if (channelUsers[channelID] === undefined) {
    return false;
  }
  if (!channelUsers[channelID].includes(username)) {
    return false;
  }
  channelUsers[channelID] = channelUsers[channelID].filter(
    subscribedUsername => subscribedUsername !== username,
  );
  DATA.set("channelUsers", channelUsers);
  return true;
}

/**
 * Returns all channels with active alerts
 *
 * @returns {Array<string>}} channel IDs
 */
function getLiveChannels() {
  const messages = DATA.get("userMessages");
  const channelIDs = {};
  Object.keys(messages).forEach(userID => {
    messages[userID].forEach(message => {
      channelIDs[message.channelID] = true;
    });
  });
  return Object.keys(channelIDs);
}

/**
 * Get a symbol to append to the channel name when an alert is active
 *
 * @param {string} channelID
 * @returns {?string} Symbol like an emoji or character
 */
function getLiveSymbolForChannel(channelID) {
  const channelLiveSymbols = DATA.get("channelLiveSymbols");
  return channelLiveSymbols[channelID] || null;
}

/**
 * Set a symbol to append to the channel name when an alert is active
 *
 * @param {string} channelID
 * @param {string} symbol
 */
function setLiveSymbolForChannel(channelID, symbol) {
  const channelLiveSymbols = DATA.get("channelLiveSymbols");
  channelLiveSymbols[channelID] = symbol;
  DATA.set("channelLiveSymbols", channelLiveSymbols);
}

/**
 * Clear the symbol to append to the channel name when an alert is active
 *
 * @param {string} channelID
 */
function clearLiveSymbolForChannel(channelID) {
  const channelLiveSymbols = DATA.get("channelLiveSymbols");
  delete channelLiveSymbols[channelID];
  DATA.set("channelLiveSymbols", channelLiveSymbols);
}

/**
 * Get currently active alerts about a user
 *
 * @param {string} userID
 * @returns {Array<{channelID: string, messageID: string}>} messages
 */
function getMessages(userID) {
  const messages = DATA.get("userMessages");
  return messages[userID] || [];
}

/**
 * Add a list message alerts sent about a user
 *
 * @param {string} userID
 * @param {Array<{channelID: string, messageID: string}>} messageList
 */
function addMessages(userID, messageList) {
  const messages = DATA.get("userMessages");
  if (messages[userID] === undefined) {
    messages[userID] = [];
  }
  messages[userID] = messages[userID].concat(messageList);
  DATA.set("userMessages", messages);
}

/**
 * Remove list of active alerts about a user
 *
 * @param {string} userID
 */
function removeMessages(userID) {
  const messages = DATA.get("userMessages");
  if (messages[userID] !== undefined) {
    delete messages[userID];
  }
  DATA.set("userMessages", messages);
}

module.exports = {
  getUsers,
  getUsersForChannel,
  getChannelsForUser,
  subscribeChannelToUser,
  unsubscribeChannelToUser,
  getLiveChannels,
  getLiveSymbolForChannel,
  setLiveSymbolForChannel,
  clearLiveSymbolForChannel,
  getMessages,
  addMessages,
  removeMessages,
};
