const fs = require("fs");
const Commands = require("./src/commands/Commands.js");
const Config = require("./src/Config.js");
const DataStore = require("./lib/DataStore.js");
const Discord = require("discord.js");
const RemindersDataStore = require("./src/RemindersDataStore.js");
const TwitchAlertsDataStore = require("./src/TwitchAlertsDataStore.js");
const TwitchAPI = require("./lib/TwitchAPI.js");
const WebhookHandlers = require("./src/WebhookHandlers.js");
const WebhookServer = require("./lib/WebhookServer.js");

async function onMessage(client, message) {
  // Log all messages sent by bot
  if (message.author.id === client.user.id) {
    console.log(`Sent message: "${message.content}"`);
    return;
  }
  let _mention = null;
  let command = null;
  let args = null;
  const messageParts = message.content.split(" ").filter((part) => part !== "");
  switch (message.channel.type) {
    case "dm":
      if (message.mentions.has(client.user)) {
        [_mentions, command, ...args] = messageParts;
      } else {
        [command, ...args] = messageParts;
      }
      console.log(
        `Direct messaged by ${message.author.username}: "${message.content}"`,
      );
      break;
    case "text":
      // Only respond to message where the bot is mentioned explicitly
      if (!message.mentions.has(client.user) || message.mentions.everyone) {
        return;
      }
      [_mention, command, ...args] = messageParts;
      console.log(
        `Mentioned by ${message.author.username} in channel ${message.channel.id}: "${message.content}"`,
      );
      break;
    default:
      console.log(
        `Received message from ${message.author.username} in unknown channel type "${message.channel.type}": "${message.content}"`,
      );
  }
  switch ((command || "").toLowerCase()) {
    case "reminders":
      await Commands.reminders.viewReminders(message);
      return;
    case "remind":
      await Commands.reminders.addReminder(message, args.join(" "));
      return;
    case "forget":
      await Commands.reminders.removeReminder(message, args[0]);
      return;
    case "quote":
      await Commands.quote.randomQuote(message);
      return;
    case "who":
      await Commands.quote.randomQuoteAuthor(message);
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
          "`reminders`, " +
          "`remind <user/role> to <do something> in <time>`, " +
          "`forget <reminder #>`, " +
          "`quote`, " +
          "`who`, " +
          "`subs`, " +
          "`sub <username>`, " +
          "`unsub <username>`, " +
          "`view_live_symbol`, " +
          "`set_live_symbol <symbol>`, and " +
          "`clear_live_symbol`.",
      );
      return;
  }
}

async function init() {
  const {
    DISCORD_TOKEN,
    DISCORD_MESSAGE_CACHE_MAX_SIZE,
    DISCORD_MESSAGE_CACHE_LIFETIME_SECONDS,
    DISCORD_MESSAGE_SWEEP_INTERVAL_SECONDS,
    REMINDERS_CHECK_INTERVAL_SECONDS,
    TWITCH_WEBHOOK_RESUBSCRIBE_SECONDS,
  } = Config.get();
  const client = new Discord.Client({
    messageCacheMaxSize: DISCORD_MESSAGE_CACHE_MAX_SIZE,
    messageCacheLifetime: DISCORD_MESSAGE_CACHE_LIFETIME_SECONDS,
    messageSweepInterval: DISCORD_MESSAGE_SWEEP_INTERVAL_SECONDS,
  });
  client.on("message", onMessage.bind(this, client));
  await client.login(DISCORD_TOKEN);
  console.log(`Logged in as ${client.user.tag}!`);
  // Resubscribe webhooks regularly
  await WebhookServer.startServer(WebhookHandlers.getHandlers(client));
  await resubscribeTwitchWebhooks();
  client.setInterval(
    resubscribeTwitchWebhooks,
    TWITCH_WEBHOOK_RESUBSCRIBE_SECONDS * 1000,
  );
  // Check for any reminders that need to be announced regularly
  await announceReminders(client);
  client.setInterval(
    announceReminders.bind(this, client),
    REMINDERS_CHECK_INTERVAL_SECONDS * 1000,
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

async function announceReminders(discordClient) {
  const channels = await Promise.all(
    RemindersDataStore.getChannelsWithReminders().map(
      async (channelID) => await discordClient.channels.fetch(channelID),
    ),
  );
  for (let channelIdx = 0; channelIdx < channels.length; channelIdx++) {
    const channel = channels[channelIdx];
    if (channel.type !== "dm" && channel.type !== "text") {
      continue;
    }
    const reminders = RemindersDataStore.getRemindersForChannel(channel.id);
    // Iterate in reverse so removing reminders does not mess up the indexes of the rest
    for (
      let reminderIdx = reminders.length - 1;
      reminderIdx >= 0;
      reminderIdx--
    ) {
      const { content, target, timestamp } = reminders[reminderIdx];
      if (timestamp <= Date.now()) {
        let mention = null;
        switch (target.type) {
          case "role":
            mention = `<@&${target.id}>`;
            break;
          case "user":
            mention = `<@${target.id}>`;
            break;
        }
        if (mention !== null) {
          await channel.send(
            `${mention}, this is your reminder to **${content}**.`,
          );
        }
        RemindersDataStore.removeReminderForChannel(channel.id, reminderIdx);
      }
    }
  }
}

init();
