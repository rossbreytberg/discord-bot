const fetch = require("node-fetch");
const Config = require("../src/Config.js");
const WebhookServer = require("./WebhookServer.js");

const API_ENDPOINT = "https://api.twitch.tv/helix/";
const CLIENT_ID = Config.get().TWITCH_CLIENT_ID;
const CLIENT_SECRET = Config.get().TWITCH_CLIENT_SECRET;
const WEBHOOK_PATH_PREFIX = "twitch";
const WEBHOOK_LEASE_SECONDS = Config.get().TWITCH_WEBHOOK_LEASE_SECONDS;

/**
 *
 * @param {string} gameID
 * @returns See https://dev.twitch.tv/docs/api/reference#get-games
 */
async function getGameInfo(gameID) {
  const response = await apiRequest("GET", `games?id=${gameID}`);
  const responseData = await response.json();
  return responseData.data[0] || null;
}

/**
 * Get information about a user
 *
 * @param {string} username
 * @returns See https://dev.twitch.tv/docs/api/reference#get-users
 */
async function getUserInfo(username) {
  const response = await apiRequest("GET", `users?login=${username}`);
  const responseData = await response.json();
  return (responseData && responseData.data && responseData.data[0]) || null;
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
 * Subscribe or unsubscribe to a user's stream changes
 *
 * @param {boolean} mode
 * @param {string} userID
 * @returns {Promise<boolean>} success
 */
async function setStreamChangeSubscription(mode, userID) {
  return await setWebhookSubscription(mode, `streams?user_id=${userID}`);
}

/**
 * Get current list of webhook subscriptions
 *
 * @returns See https://dev.twitch.tv/docs/api/reference/#get-webhook-subscriptions
 */
async function getWebhookSubscriptions() {
  const response = await apiRequest("GET", "webhooks/subscriptions");
  const responseData = await response.json();
  return responseData;
}

/**
 * Clear all current webhook subscriptions
 * Even if this function returns true,
 * the webhook server will have to confirm the update
 *
 * @returns {Promise<boolean>} success
 */
async function clearWebhookSubscriptions() {
  const subscriptions = await getWebhookSubscriptions();
  const results = await Promise.all(
    subscriptions.data.map(async (subscription) => {
      const { topic } = subscription;
      return await setWebhookSubscription("unsubscribe", topic);
    }),
  );
  return !results.includes(false);
}

/**
 * Subscribe or unsubscribe from a webhook event
 * Even if this function returns true,
 * the webhook server will have to confirm the update
 *
 * @param {'subscribe' | 'unsubscribe'} mode
 * @param {string} topic
 * @returns {Promise<boolean>} success
 */
async function setWebhookSubscription(mode, path) {
  const topic = API_ENDPOINT + path;
  const response = await apiRequest(
    "POST",
    "webhooks/hub",
    null,
    JSON.stringify({
      "hub.callback": `${WebhookServer.HOST}:${WebhookServer.PORT}/${WEBHOOK_PATH_PREFIX}/${path}`,
      "hub.mode": mode,
      "hub.topic": topic,
      "hub.lease_seconds": WEBHOOK_LEASE_SECONDS,
      "hub.secret": WebhookServer.SECRET,
    }),
  );
  const success = response.status === 202;
  if (success) {
    WebhookServer.addPendingSubscription(WEBHOOK_PATH_PREFIX, topic, mode);
  }
  return success;
}

/**
 * Send an API request
 *
 * @param {string} method
 * @param {string} path
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
    console.error(
      `Twitch API request error "${response.status} ${response.statusText}" at "${method} ${url}"`,
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
  getUserInfo,
  getUserProfileUrl,
  clearWebhookSubscriptions,
  setStreamChangeSubscription,
};
