const fs = require("fs");
const Commands = require("./src/Commands.js");
const Config = require("./src/Config.js");
const DataStore = require("./lib/DataStore.js");
const Discord = require("discord.js");
const TwitchAlertsDataStore = require("./src/TwitchAlertsDataStore.js");
const TwitchAPI = require("./lib/TwitchAPI.js");
const WebhookHandlers = require("./src/WebhookHandlers.js");
const WebhookServer = require("./lib/WebhookServer.js");

const DISCORD_TOKEN = Config.get().DISCORD_TOKEN;
const TWITCH_WEBHOOK_RESUBSCRIBE_SECONDS = Config.get()
  .TWITCH_WEBHOOK_RESUBSCRIBE_SECONDS;

async function onMessage(client, message) {
  // Only respond to message where the bot is mentioned
  if (!message.isMentioned(client.user)) {
    return;
  }
  console.log(
    `Mentioned by ${message.author.username} in message "${message.content}"`,
  );
  const [mention, command, ...args] = message.content.split(" ");
  switch ((command || "").toLowerCase()) {
    case "enable_twitch":
    case "enable_twitch_alerts":
    case "twitch_alerts_enable":
    case "twitch_enable":
      await Commands.twitchAlertsEnable(message);
      return;
    case "disable_twitch":
    case "disable_twitch_alerts":
    case "twitch_alerts_disable":
    case "twitch_disable":
      await Commands.twitchAlertsDisable(message);
      return;
    case "list_twitch_subs":
    case "list_twitch_subscriptions":
    case "twitch_list_subs":
    case "twitch_list_subscriptions":
      await Commands.twitchListSubscriptions(message);
      return;
    case "twitch_sub":
    case "twitch_subscribe":
      await Commands.twitchSubscribe(message, args[0]);
      return;
    case "twitch_unsub":
    case "twitch_unsubscribe":
      await Commands.twitchUnsubscribe(message, args[0]);
      return;
    default:
      await message.channel.send(
        "I don't understand. Valid commands are " +
          "`enable_twitch_alerts`, " +
          "`disable_twitch_alerts`, " +
          "`list_twitch_subs`, " +
          "`twitch_sub <username>`, and " +
          "`twitch_unsub <username>`.",
      );
      return;
  }
}

async function init() {
  const client = new Discord.Client();
  client.on("message", onMessage.bind(this, client));
  await client.login(DISCORD_TOKEN);
  console.log(`Logged in as ${client.user.tag}!`);
  await WebhookServer.startServer(WebhookHandlers.getHandlers(client));
  // Resubscribe webhooks every 12 hours
  await resubscribeTwitchWebhooks();
  client.setInterval(
    resubscribeTwitchWebhooks,
    TWITCH_WEBHOOK_RESUBSCRIBE_SECONDS * 1000,
  );
}

async function resubscribeTwitchWebhooks() {
  await TwitchAPI.clearWebhookSubscriptions();
  TwitchAlertsDataStore.getUsers().forEach(async username => {
    const userInfo = await TwitchAPI.getUserInfo(username);
    const subscribed = await TwitchAPI.setStreamChangeSubscription(
      "subscribe",
      userInfo.id,
    );
  });
}

init();
