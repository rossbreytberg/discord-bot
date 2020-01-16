const TwitchAlertsDataStore = require("./TwitchAlertsDataStore.js");
const TwitchAPI = require("../lib/TwitchAPI.js");

async function twitchAlertsDisable(message) {
  const success = TwitchAlertsDataStore.removeChannel(message.channel.id);
  if (!success) {
    await message.channel.send(
      "Your action did nothing. " +
        "This channel was already not receiving Twitch alerts.",
    );
    return;
  }
  await message.channel.send(
    "This channel will no longer receive Twitch alerts.",
  );
}

async function twitchAlertsEnable(message) {
  const success = TwitchAlertsDataStore.addChannel(message.channel.id);
  if (!success) {
    await message.channel.send(
      "Your action did nothing. This channel already receives Twitch alerts.",
    );
    return;
  }
  await message.channel.send(
    "This channel will now receive Twitch alerts " +
      "when subscribed users start streaming.",
  );
}

async function twitchListSubscriptions(message) {
  if (!TwitchAlertsDataStore.getChannels().includes(message.channel.id)) {
    await message.channel.send("This channel is not receiving Twitch alerts.");
    return;
  }
  await message.channel.send(
    "Currently subscribed to Twitch alerts for " +
      TwitchAlertsDataStore.getUsers()
        .map(username => `**${username}**`)
        .join(", "),
  );
}

async function twitchSubscribe(message, arg) {
  const username = arg && arg.toLowerCase();
  if (!username) {
    await message.channel.send(
      "Please provide a username to subscribe to. " +
        "For example, `twitch_subscribe cheezmasta125`.",
    );
    return;
  }
  const success = TwitchAlertsDataStore.addUser(username);
  if (!success) {
    await message.channel.send(
      "Your action did nothing. " + "This user was already subscribed to.",
    );
    return;
  }
  const userInfo = await TwitchAPI.getUserInfo(username);
  await TwitchAPI.setStreamChangeSubscription("subscribe", userInfo.id);
  await message.channel.send(
    `Successfully subscribed to ${userInfo.display_name}.`,
  );
}

async function twitchUnsubscribe(message, arg) {
  const username = arg && arg.toLowerCase();
  if (!username) {
    await message.channel.send(
      "Please provide a username to unsubscribe from. " +
        "For example, `twitch_unsubscribe cheezmasta125`.",
    );
    return;
  }
  const success = TwitchAlertsDataStore.removeUser(username);
  if (!success) {
    await message.channel.send(
      "Your action did nothing. " + "This user was not subscribed to.",
    );
    return;
  }
  const userInfo = await TwitchAPI.getUserInfo(username);
  await TwitchAPI.setStreamChangeSubscription("unsubscribe", userInfo.id);
  await message.channel.send(
    `Successfully unsubscribed from ${userInfo.display_name}.`,
  );
}

module.exports = {
  twitchAlertsDisable,
  twitchAlertsEnable,
  twitchListSubscriptions,
  twitchSubscribe,
  twitchUnsubscribe,
};
