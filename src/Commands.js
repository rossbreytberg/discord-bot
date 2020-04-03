const TwitchAlertsDataStore = require("./TwitchAlertsDataStore.js");
const TwitchAPI = require("../lib/TwitchAPI.js");

async function twitchListSubscriptions(message) {
  const users = TwitchAlertsDataStore.getUsersForChannel(message.channel.id);
  if (users.length === 0) {
    await message.channel.send(
      "This channel is not subscribed to Twitch alerts for any users.",
    );
    return;
  }
  await message.channel.send(
    "Currently subscribed to Twitch alerts for " +
      users.map(username => `**${username}**`).join(", "),
  );
}

async function twitchSubscribe(message, args) {
  const usernames = args.map(arg => arg.toLowerCase());
  if (usernames.length === 0) {
    await message.channel.send(
      "Please provide a username to subscribe to. " +
        "For example, `sub warslaughters`.",
    );
    return;
  }
  usernames.forEach(async username => {
    const success = TwitchAlertsDataStore.subscribeChannelToUser(
      message.channel.id,
      username,
    );
    const userInfo = await TwitchAPI.getUserInfo(username);
    if (!success) {
      await message.channel.send(
        `${userInfo.display_name} was already subscribed to.`,
      );
      return;
    }
    await TwitchAPI.setStreamChangeSubscription("subscribe", userInfo.id);
    await message.channel.send(
      `Successfully subscribed to ${userInfo.display_name}.`,
    );
  });
}

async function twitchUnsubscribe(message, args) {
  const usernames = args.map(arg => arg.toLowerCase());
  if (usernames.length === 0) {
    await message.channel.send(
      "Please provide a username to unsubscribe from. " +
        "For example, `unsub cheezmasta125`.",
    );
    return;
  }
  usernames.forEach(async username => {
    const success = TwitchAlertsDataStore.unsubscribeChannelToUser(
      message.channel.id,
      username,
    );
    const userInfo = await TwitchAPI.getUserInfo(username);
    if (!success) {
      await message.channel.send(
        `${userInfo.display_name} was already not subscribed to.`,
      );
      return;
    }
    await TwitchAPI.setStreamChangeSubscription("unsubscribe", userInfo.id);
    await message.channel.send(
      `Successfully unsubscribed from ${userInfo.display_name}.`,
    );
  });
}

async function twitchSetLiveSymbol(message, arg) {
  const success = TwitchAlertsDataStore.setLiveSymbolForChannel(
    message.channel.id,
    arg,
  );
  await message.channel.send(
    `Successfully set ${arg} as the live symbol for this channel. ` +
      "It will be appended after the channel name when someone is live.",
  );
}

async function twitchClearLiveSymbol(message) {
  const success = TwitchAlertsDataStore.clearLiveSymbolForChannel(
    message.channel.id,
  );
  await message.channel.send(
    "There will no longer be a live symbol for this channel.",
  );
}

module.exports = {
  twitchListSubscriptions,
  twitchSubscribe,
  twitchUnsubscribe,
  twitchSetLiveSymbol,
  twitchClearLiveSymbol,
};
