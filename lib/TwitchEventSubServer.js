const crypto = require("crypto");
const http = require("http");
const url = require("url");
const Config = require("../src/Config.js");

const HOST = Config.get().TWITCH_EVENT_CALLBACK_HOST;
const PATH = Config.get().TWITCH_EVENT_CALLBACK_PATH;
const PORT_EXTERNAL = Config.get().TWITCH_EVENT_CALLBACK_PORT_EXTERNAL;
const PORT_INTERNAL = Config.get().TWITCH_EVENT_CALLBACK_PORT_INTERNAL;
const SECRET = Config.get().TWITCH_EVENT_CALLBACK_SECRET;

/**
 * Start a server to receive Twitch EventSub events
 * See https://dev.twitch.tv/docs/eventsub
 *
 * @param {(subscription, event) => void} handleEvent
 */
async function startServer(handleEvent) {
  const server = http.createServer((request, response) => {
    const chunks = [];
    request
      .on("error", (error) =>
        console.error(
          `Twitch EventSub server error during incoming request ${error}`,
        ),
      )
      .on("data", (chunk) => chunks.push(chunk))
      .on("end", () => {
        const body = Buffer.concat(chunks).toString();

        // Fail if invalid signature
        if (!isRequestValid(request.headers, body)) {
          response.writeHead(403);
          response.end();
          console.log(
            `Twitch EventSub server rejected invalid request "${
              request.method
            } ${request.url}" ${JSON.stringify(request.headers)} ${body}`,
          );
          return;
        }

        // Fail if cannot parse body
        let bodyParsed = null;
        try {
          bodyParsed = JSON.parse(body);
        } catch (error) {
          response.writeHead(400);
          response.end();
          console.error(
            `Twitch EventSub server failed to parse request body ${body}`,
          );
          return;
        }
        const subscription = bodyParsed.subscription;
        if (!subscription) {
          response.writeHead(400);
          response.end();
          console.error(
            `Twitch EventSub server request missing subscription in body ${body}`,
          );
          return;
        }

        // Handle successful requests
        response.writeHead(200, { "content-type": "text/plain" });
        switch (request.headers["twitch-eventsub-message-type"]) {
          case "webhook_callback_verification":
            response.write(bodyParsed.challenge);
            response.end();
            console.log(
              `Twitch EventSub server verified subscription "${
                subscription.type
              }" ${JSON.stringify(subscription.condition)}`,
            );
            break;
          case "revocation":
            response.end();
            console.log(
              `Twitch EventSub server received revocation "${
                subscription.type
              }" ${JSON.stringify(subscription.condition)}`,
            );
            break;
          case "notification":
            response.end();
            console.log(
              `Twitch EventSub server received notification "${
                subscription.type
              }" ${JSON.stringify(subscription.condition)} ${JSON.stringify(
                bodyParsed.event,
              )}`,
            );
            handleEvent(subscription, bodyParsed.event);
            break;
        }
      });
  });

  server.listen(PORT_INTERNAL, (error) => {
    if (error) {
      console.error("Twitch EventSub server failed to start:", error);
    }
    console.log("Twitch EventSub server started");
  });
}

/**
 * Verify if the request is valid
 *
 * @param {object} headers
 * @param {string} body
 */
function isRequestValid(headers, body) {
  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", SECRET)
    .update(
      headers["twitch-eventsub-message-id"] +
        headers["twitch-eventsub-message-timestamp"] +
        body,
    )
    .digest("hex")}`;
  return headers["twitch-eventsub-message-signature"] === expectedSignature;
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
  startServer,
  HOST,
  PATH,
  PORT_EXTERNAL,
  SECRET,
};
