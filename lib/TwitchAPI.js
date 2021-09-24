const fetch = require("node-fetch");
const Config = require("../src/Config.js");
const TwitchEventSubServer = require("./TwitchEventSubServer.js");

const API_ENDPOINT = "https://api.twitch.tv/helix/";
const SUBSCRIPTIONS_PATH = "eventsub/subscriptions";
const CLIENT_ID = Config.get().TWITCH_CLIENT_ID;
const CLIENT_SECRET = Config.get().TWITCH_CLIENT_SECRET;

/**
 * Get information about a game
 *
 * @param {string} gameID
 * @returns See https://dev.twitch.tv/docs/api/reference#get-games
 */
async function getGameInfo(gameID) {
  const response = await apiRequest("GET", `games?id=${gameID}`);
  return await getFirstResponseData(response);
}
/**
 * Get information about a stream
 *
 * @param {string} userID
 * @returns See https://dev.twitch.tv/docs/api/reference#get-streams
 */
async function getStreamInfo(userID) {
  const response = await apiRequest("GET", `streams?user_id=${userID}`);
  return await getFirstResponseData(response);
}

/**
 * Get information about a user
 *
 * @param {string} username
 * @returns See https://dev.twitch.tv/docs/api/reference#get-users
 */
async function getUserInfo(username) {
  const response = await apiRequest("GET", `users?login=${username}`);
  return await getFirstResponseData(response);
}

/**
 * Get a user's profile url
 *
 * @param {string} username
 * @param {boolean} hideProtocol
 * @returns {string} profile url
 */
function getUserProfileUrl(username, hideProtocol) {
  return `${
    hideProtocol ? "" : "https://"
  }www.twitch.tv/${username.toLowerCase()}`;
}

/**
 * Subscribe to a user's stream changes
 *
 * @param {string} userID
 */
async function createStreamChangeSubscription(userID) {
  const condition = { broadcaster_user_id: userID };
  await Promise.all([
    createSubscription("channel.update", condition),
    createSubscription("stream.online", condition),
    createSubscription("stream.offline", condition),
  ]);
}

/**
 * Unsubscribe to a user's stream changes
 *
 * @param {string} userID
 */
async function deleteStreamChangeSubscription(userID) {
  const subscriptions = await getSubscriptions();
  for (let i = 0; i < subscriptions.data.length; i++) {
    const subscription = subscriptions.data[i];
    if (
      ["channel.update", "stream.online", "stream.offline"].includes(
        subscription.type,
      ) &&
      subscription.condition.broadcaster_user_id === userID
    ) {
      deleteSubscription(subscription.id);
    }
  }
}

/**
 * Get current list of subscriptions
 * @returns See https://dev.twitch.tv/docs/eventsub
 */
async function getSubscriptions() {
  const response = await apiRequest("GET", SUBSCRIPTIONS_PATH);
  return await response.json();
}

/**
 * Clear all current subscriptions
 */
async function clearSubscriptions() {
  const subscriptions = await getSubscriptions();
  subscriptions.data.map((subscription) => {
    deleteSubscription(subscription.id);
  });
}

/**
 * Create a subscription
 *
 * @param {string} type
 * @param {object} condition
 */
async function createSubscription(type, condition) {
  await apiRequest(
    "POST",
    SUBSCRIPTIONS_PATH,
    null,
    JSON.stringify({
      type: type,
      version: "1",
      condition: condition,
      transport: {
        method: "webhook",
        callback: `${TwitchEventSubServer.HOST}:${TwitchEventSubServer.PORT_EXTERNAL}/${TwitchEventSubServer.PATH}`,
        secret: TwitchEventSubServer.SECRET,
      },
    }),
  );
}

/**
 * Delete a subscription
 *
 * @param {string} subscriptionID
 */
async function deleteSubscription(subscriptionID) {
  await apiRequest(
    "DELETE",
    `${SUBSCRIPTIONS_PATH}?id=${subscriptionID}`,
    null,
    null,
  );
}

/**
 * Safely get the first item in response data.
 *
 * @param {See https://developer.mozilla.org/en-US/docs/Web/API/Response} response
 * @returns {object}
 */
async function getFirstResponseData(response) {
  const responseData = await response.json();
  return (responseData && responseData.data && responseData.data[0]) || null;
}

/**
 * Send an API request
 *
 * @param {string} method
 * @param {string} path
 * @param {?{[string]:string}} headers
 * @param {?string} body
 * @returns See https://developer.mozilla.org/en-US/docs/Web/API/Response
 */
async function apiRequest(method, path, headers, body) {
  const url = API_ENDPOINT + path;
  const appToken = await appTokenRequest();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${appToken}`,
      "Client-ID": CLIENT_ID,
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });
  if (!response.ok) {
    const responseText = await response.text();
    console.error(
      `Twitch API error ${responseText} at "${method} ${url}" ${JSON.stringify(
        headers,
      )} ${JSON.stringify(body)}`,
    );
  }
  return response;
}

let APP_TOKEN = null;
/**
 * Request an app token
 *
 * @returns {Promise<string>} app token
 */
async function appTokenRequest() {
  if (APP_TOKEN) {
    return APP_TOKEN;
  }
  const response = await fetch(
    "https://id.twitch.tv/oauth2/token?grant_type=client_credentials" +
      `&client_id=${CLIENT_ID}` +
      `&client_secret=${CLIENT_SECRET}`,
    {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        "Content-Type": "application/json",
      },
    },
  );
  const responseData = await response.json();
  APP_TOKEN = responseData.access_token;
  return APP_TOKEN;
}

module.exports = {
  getGameInfo,
  getStreamInfo,
  getUserInfo,
  getUserProfileUrl,
  clearSubscriptions,
  createStreamChangeSubscription,
  deleteStreamChangeSubscription,
};
