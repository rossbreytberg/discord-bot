const TwitchAlertsDataStore = require("./../TwitchAlertsDataStore.js");
const TwitchAPI = require("../../lib/TwitchAPI.js");

async function listSubscriptions(message) {
  const users = TwitchAlertsDataStore.getUsersForChannel(message.channel.id);
  if (users.length === 0) {
    await message.channel.send(
      "This channel is not subscribed to Twitch alerts for any users.",
    );
    return;
  }
  await message.channel.send(
    "Currently subscribed to Twitch alerts for " +
      users.map((username) => `**${username}**`).join(", "),
  );
}

async function subscribe(message, args) {
  const usernames = args.map((arg) => arg.toLowerCase());
  if (usernames.length === 0) {
    await message.channel.send(
      "Please provide a username to subscribe to. " +
        "For example, `sub warslaughters`.",
    );
    return;
  }
  const userInfo = await TwitchAPI.getUserInfo(username);
  if (!userInfo) {
    await message.channel.send("Could not find a Twitch user with that name.");
    return;
  }
  usernames.forEach(async (username) => {
    const previousChannelsForUser = TwitchAlertsDataStore.getChannelsForUser(
      username,
    );
    const success = TwitchAlertsDataStore.subscribeChannelToUser(
      message.channel.id,
      username,
    );
    if (!success) {
      await message.channel.send(
        `**${userInfo.display_name}** was already subscribed to.`,
      );
      return;
    }
    if (previousChannelsForUser.length === 0) {
      await TwitchAPI.setStreamChangeSubscription("subscribe", userInfo.id);
    }
    await message.channel.send(
      `Successfully subscribed to **${userInfo.display_name}**.`,
    );
  });
}

async function unsubscribe(message, args) {
  const usernames = args.map((arg) => arg.toLowerCase());
  if (usernames.length === 0) {
    await message.channel.send(
      "Please provide a username to unsubscribe from. " +
        "For example, `unsub cheezmasta125`.",
    );
    return;
  }
  usernames.forEach(async (username) => {
    const success = TwitchAlertsDataStore.unsubscribeChannelToUser(
      message.channel.id,
      username,
    );
    const userInfo = await TwitchAPI.getUserInfo(username);
    if (!success) {
      await message.channel.send(
        `**${
          (userInfo && userInfo.display_name) || username
        }** was already not subscribed to.`,
      );
      return;
    }
    const remainingChannelsForUser = TwitchAlertsDataStore.getChannelsForUser(
      username,
    );
    if (remainingChannelsForUser.length === 0) {
      await TwitchAPI.setStreamChangeSubscription("unsubscribe", userInfo.id);
    }
    await message.channel.send(
      `Successfully unsubscribed from **${userInfo.display_name}**.`,
    );
  });
}

async function viewLiveSymbol(message) {
  if (message.channel.type === "dm") {
    await message.channel.send(
      "Live symbols are only for server channels, not for direct message threads.",
    );
    return;
  }
  const symbol = TwitchAlertsDataStore.getLiveSymbolForChannel(
    message.channel.id,
  );
  if (symbol === null) {
    await message.channel.send("A live symbol is not set for this channel.");
    return;
  }
  await message.channel.send(
    `The live symbol for this channel is "${symbol}".`,
  );
}

async function setLiveSymbol(message, arg) {
  if (message.channel.type === "dm") {
    await message.channel.send(
      "Live symbols are only for server channels, not for direct message threads.",
    );
    return;
  }
  if (TwitchAlertsDataStore.getLiveChannels().includes(message.channel.id)) {
    await message.channel.send(
      "Cannot set a live symbol for this channel while someone is currently live.",
    );
    return;
  }
  const symbol = arg.toLowerCase();
  TwitchAlertsDataStore.setLiveSymbolForChannel(message.channel.id, symbol);
  await message.channel.send(
    `Successfully set ${symbol} as the live symbol for this channel. ` +
      "It will be appended after the channel name when someone is live.",
  );
}

async function clearLiveSymbol(message) {
  if (message.channel.type === "dm") {
    await message.channel.send(
      "Live symbols are only for server channels, not for direct message threads.",
    );
    return;
  }
  if (TwitchAlertsDataStore.getLiveChannels().includes(message.channel.id)) {
    await message.channel.send(
      "Cannot clear the live symbol for this channel while someone is currently live.",
    );
    return;
  }
  TwitchAlertsDataStore.clearLiveSymbolForChannel(message.channel.id);
  await message.channel.send(
    "There will no longer be a live symbol for this channel.",
  );
}

module.exports = {
  listSubscriptions,
  subscribe,
  unsubscribe,
  viewLiveSymbol,
  setLiveSymbol,
  clearLiveSymbol,
};
