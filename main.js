const fs = require("fs");
const Commands = require("./src/commands/Commands.js");
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
  if (!message.mentions.has(client.user)) {
    return;
  }
  console.log(
    `Mentioned by ${message.author.username} in message "${message.content}"`,
  );
  const [mention, command, ...args] = message.content.split(" ");
  switch ((command || "").toLowerCase()) {
    case "quote":
      await Commands.misc.randomQuote(message);
      return;
    case "who":
      await Commands.misc.randomQuoteAuthor(message);
      return;
    case "subs":
      await Commands.twitch.listSubscriptions(message);
      return;
    case "sub":
      await Commands.twitch.subscribe(message, args);
      return;
    case "unsub":
      await Commands.twitch.unsubscribe(message, args);
      return;
    case "view_live_symbol":
      await Commands.twitch.viewLiveSymbol(message);
      return;
    case "set_live_symbol":
      await Commands.twitch.setLiveSymbol(message, args[0]);
      return;
    case "clear_live_symbol":
      await Commands.twitch.clearLiveSymbol(message);
      return;
    default:
      await message.channel.send(
        "Valid commands are " +
          "`quote`, " +
          "`who`, " +
          "`subs`, " +
          "`sub <username>`, " +
          "`unsub <username>`, " +
          "`view_live_symbol`, " +
          "`set_live_symbol <symbol>`, and" +
          "`clear_live_symbol`.",
      );
      return;
  }
}

async function init() {
  const client = new Discord.Client();
  client.on("message", onMessage.bind(this, client));
  await client.login(DISCORD_TOKEN);
  console.log(`Logged in as ${client.user.tag}!`);
  // Resubscribe webhooks every 12 hours
  await WebhookServer.startServer(WebhookHandlers.getHandlers(client));
  await resubscribeTwitchWebhooks();
  client.setInterval(
    resubscribeTwitchWebhooks,
    TWITCH_WEBHOOK_RESUBSCRIBE_SECONDS * 1000,
  );
  // Stop any typing from previous runs
  await stopAllTyping(client);
}

async function stopAllTyping(client) {
  await Promise.all(
    client.channels.cache.array().map(async (channel) => {
      if (channel.type === "text") {
        await channel.stopTyping(/*force*/ true);
      }
    }),
  );
}

async function resubscribeTwitchWebhooks() {
  await TwitchAPI.clearWebhookSubscriptions();
  TwitchAlertsDataStore.getUsers().forEach(async (username) => {
    const userInfo = await TwitchAPI.getUserInfo(username);
    const subscribed = await TwitchAPI.setStreamChangeSubscription(
      "subscribe",
      userInfo.id,
    );
  });
}

init();
