const config = require("../config.json");
const crypto = require("crypto");
const http = require("http");
const url = require("url");

const HOST = config.WEBHOOK_HOST;
const PORT = config.WEBHOOK_PORT;
const SECRET = config.WEBHOOK_SECRET;
const PENDING_SUBSCRIPTIONS = {
  // key = subscription token (service + topic)
  // value = mode (subscribe or unsubscribe)
};

/**
 * Start a server to receive webhook events
 *
 * @param {{[string]: Function}} eventHandlers
 */
async function startServer(eventHandlers) {
  const server = http.createServer((request, response) => {
    const requestUrl = url.parse(request.url, true);
    const service = getServiceFromRequestUrl(requestUrl);
    // Confirm updates to subscriptions
    if (request.method === "GET") {
      const {
        "hub.mode": mode,
        "hub.topic": topic,
        "hub.challenge": challenge,
      } = requestUrl.query;
      const token = getSubscriptionToken(service, topic);
      if (PENDING_SUBSCRIPTIONS[token] === mode) {
        delete PENDING_SUBSCRIPTIONS[token];
        response.writeHead(200, {
          "Content-Type": "text/plain",
        });
        response.write(challenge);
        console.log(
          `Webhook server ${mode}d for service "${service}" and topic "${topic}"`,
        );
      } else {
        response.writeHead(404);
        console.error(
          `Webhook server rejected invalid ${mode} for service "${service}" and topic "${topic}"`,
        );
      }
      response.end();
      return;
    }
    // Handle subscription data
    request.on("data", chunk => {
      const signature = `sha256=${crypto
        .createHmac("sha256", SECRET)
        .update(chunk)
        .digest("hex")}`;
      const isValid = request.headers["x-hub-signature"] === signature;
      if (!isValid) {
        console.error("Invalid signature on webhook subscription");
        return;
      }
      const data = JSON.parse(chunk);
      // Call appropriate event handler
      const event = getEventFromRequestUrl(requestUrl);
      console.log(
        `Calling webhook event handler for service "${service}" and event "${event}"`,
      );
      const handler = eventHandlers[`${service}/${event}`];
      handler && handler(requestUrl.query, data);
    });
    response.end();
  });

  server.listen(PORT, error => {
    if (error) {
      console.error("Webhook server failed to start:", error);
    }
    console.log("Webhook server started");
  });
}

/**
 * Add a pending subscription so the server expects it and will confirm it
 *
 * @param {string} service
 * @param {string} topic
 * @param {'subscribe' | 'unsubscribe'} mode
 */
function addPendingSubscription(service, topic, mode) {
  PENDING_SUBSCRIPTIONS[getSubscriptionToken(service, topic)] = mode;
}

/**
 * Creates a token to represent a pending subscription
 *
 * @param {string} service
 * @param {string} topic
 * @returns {string} token
 */
function getSubscriptionToken(service, topic) {
  return `${service}__${topic}`;
}

/**
 * Get the service from a request URL
 * For example, "https://11.222.333.44/twitch/streams" => "twitch"
 *
 * @param {*} requestUrl
 * @returns {string} service
 */
function getServiceFromRequestUrl(requestUrl) {
  const path = getPathFromRequestUrl(requestUrl);
  return path.substring(0, path.indexOf("/"));
}

/**
 * Get the event from a request URL
 * For example, "https://11.222.333.44/twitch/streams" => "streams"
 *
 * @param {UrlWithParsedQuery} requestUrl
 * @returns {string} event
 */
function getEventFromRequestUrl(requestUrl) {
  const path = getPathFromRequestUrl(requestUrl);
  return path.substring(path.indexOf("/") + 1);
}

/**
 * Get the path from a request URL, with leading slash removed
 *
 * @param {UrlWithParsedQuery} requestUrl
 * @returns {string} path
 */
function getPathFromRequestUrl(requestUrl) {
  return requestUrl.pathname.substring(1);
}

module.exports = {
  addPendingSubscription,
  startServer,
  HOST,
  PORT,
  SECRET,
};
