const fs = require("fs");
const https = require("https");
const Config = require("./Config.js");
const Discord = require("discord.js");
const TwitchAlertsDataStore = require("./TwitchAlertsDataStore.js");
const TwitchAPI = require("../lib/TwitchAPI.js");

const CACHE_PATH = Config.get().CACHE_PATH;
const DISCORD_IMAGE_HEIGHT = 1080;
const DISCORD_IMAGE_WIDTH = 1920;
const DISCORD_THUMBNAIL_HEIGHT = 400;
const DISCORD_THUMBNAIL_WIDTH = 300;
const TWITCH_COLOR = "#6441a5";
const TWITCH_STREAM_FETCH_RETRY_INTERVAL_MS = 10000;
const TWITCH_STREAM_FETCH_RETRY_COUNT = 6;
const TWITCH_STREAM_IMAGE_FILE = "twitch-stream-image.jpg";
const TWITCH_STREAM_IMAGE_FILEPATH = `${CACHE_PATH}/cache/${TWITCH_STREAM_IMAGE_FILE}`;

const eventHandlers = {
  "channel.update": async (discordClient, subscription, event) => {
    const {
      broadcaster_user_id: userID,
      category_id: overrideGameID,
      title: overrideTitle,
    } = event;
    const messages = TwitchAlertsDataStore.getMessages(userID);
    if (messages.length === 0) {
      // If no existing messages about the user, nothing to update
      return;
    }
    await clearMessagesAboutUser(discordClient, userID);
    // Pass in game ID and title from this event because the streams API
    // used in this function has a big delay before it updates
    await createMessagesAboutUser(
      discordClient,
      userID,
      overrideGameID,
      overrideTitle,
    );
  },
  "stream.online": async (discordClient, subscription, event) => {
    if (event.type !== "live") {
      return;
    }
    const userID = event.broadcaster_user_id;
    const liveChannelsBefore = TwitchAlertsDataStore.getLiveChannels();
    await clearMessagesAboutUser(discordClient, userID);
    await createMessagesAboutUser(discordClient, userID);
    // Set any live symbols for channels that started being live
    const liveChannelsAfter = TwitchAlertsDataStore.getLiveChannels();
    await updateChannelLiveSymbols(
      discordClient,
      liveChannelsBefore,
      liveChannelsAfter,
    );
  },
  "stream.offline": async (discordClient, subsciption, event) => {
    const userID = event.broadcaster_user_id;
    const liveChannelsBefore = TwitchAlertsDataStore.getLiveChannels();
    await clearMessagesAboutUser(discordClient, userID);
    // Clear any live symbols for channels that stopped being live
    const liveChannelsAfter = TwitchAlertsDataStore.getLiveChannels();
    await updateChannelLiveSymbols(
      discordClient,
      liveChannelsBefore,
      liveChannelsAfter,
    );
  },
};

async function clearMessagesAboutUser(discordClient, userID) {
  const messages = TwitchAlertsDataStore.getMessages(userID);
  await Promise.all(
    messages.map(async (message) => {
      const { messageID, channelID } = message;
      const channel = await discordClient.channels.fetch(channelID);
      try {
        const message = await channel.messages.fetch(messageID);
        if (message) {
          await message.delete();
        }
      } catch (error) {
        console.error("Failed to delete message", messageID, error);
      }
    }),
  );
  TwitchAlertsDataStore.removeMessages(userID);
}

async function createMessagesAboutUser(
  discordClient,
  userID,
  overrideGameID,
  overrideTitle,
  streamFetchRetryCount,
) {
  const stream = await TwitchAPI.getStreamInfo(userID);
  if (!stream) {
    console.error(
      `Cannot create message because no stream exists for user "${userID}"`,
    );
    if (
      streamFetchRetryCount == null ||
      streamFetchRetryCount < TWITCH_STREAM_FETCH_RETRY_COUNT
    ) {
      setTimeout(
        () =>
          createMessagesAboutUser(
            discordClient,
            userID,
            overrideGameID,
            overrideTitle,
            (streamFetchRetryCount || 0) + 1,
          ),
        TWITCH_STREAM_FETCH_RETRY_INTERVAL_MS,
      );
      console.log(
        `Retrying create message for user "${userID}" in ${TWITCH_STREAM_FETCH_RETRY_INTERVAL_MS}ms`,
      );
    }
    return;
  }
  const {
    game_id: streamGameID,
    thumbnail_url: streamImageUrl,
    title: streamTitle,
    type,
    user_name: username,
  } = stream;
  if (type !== "live") {
    console.error(
      `Cannot create message because stream type is not "live" for user "${userID}"`,
    );
    return;
  }
  const gameID = overrideGameID || streamGameID;
  const title = overrideTitle || streamTitle;
  const [gameInfo, userInfo] = await Promise.all([
    TwitchAPI.getGameInfo(gameID),
    TwitchAPI.getUserInfo(username),
  ]);
  const content = `**${username}** is streaming on Twitch!`;
  const gameName = gameInfo && gameInfo.name;
  const gameImageUrl = gameInfo && gameInfo.box_art_url;
  const userImageUrl = userInfo && userInfo.profile_image_url;
  const userProfileUrl = TwitchAPI.getUserProfileUrl(username);
  const richEmbed = new Discord.MessageEmbed()
    .setAuthor(username, userImageUrl, userProfileUrl)
    .setColor(TWITCH_COLOR)
    .setTitle(title)
    .setURL(userProfileUrl)
    .setFooter(TwitchAPI.getUserProfileUrl(username, true));
  if (gameName != null) {
    richEmbed.addField("Playing", gameName);
  }
  if (gameImageUrl != null) {
    richEmbed.setThumbnail(
      gameImageUrl
        .replace("{height}", DISCORD_THUMBNAIL_HEIGHT)
        .replace("{width}", DISCORD_THUMBNAIL_WIDTH),
    );
  }
  // Download the stream image and send it as an attachment
  // Otherwise, it does not display correctly
  if (streamImageUrl) {
    const streamImageFile = fs.createWriteStream(TWITCH_STREAM_IMAGE_FILEPATH);
    await new Promise((resolve) => {
      https.get(
        streamImageUrl
          .replace("{height}", DISCORD_IMAGE_HEIGHT)
          .replace("{width}", DISCORD_IMAGE_WIDTH),
        (response) => {
          const download = response.pipe(streamImageFile);
          download.on("close", resolve);
        },
      );
    });
    richEmbed
      .attachFiles([TWITCH_STREAM_IMAGE_FILEPATH])
      .setImage(`attachment://${TWITCH_STREAM_IMAGE_FILE}`);
  }
  const messages = [];
  const channelIDsToAlert = TwitchAlertsDataStore.getChannelsForUser(
    username.toLowerCase(),
  );
  await Promise.all(
    channelIDsToAlert.map(async (channelID) => {
      const channel = await discordClient.channels.fetch(channelID);
      const message = await channel.send(content, richEmbed);
      messages.push({ channelID: channel.id, messageID: message.id });
    }),
  );
  TwitchAlertsDataStore.addMessages(userID, messages);
}

async function updateChannelLiveSymbols(
  discordClient,
  liveChannelsBefore,
  liveChannelsAfter,
) {
  await Promise.all(
    discordClient.channels.cache.map(async (channel) => {
      const liveSymbol = TwitchAlertsDataStore.getLiveSymbolForChannel(
        channel.id,
      );
      if (liveSymbol === null) {
        return;
      }
      const wasLive = liveChannelsBefore.includes(channel.id);
      const isLive = liveChannelsAfter.includes(channel.id);
      if (wasLive && !isLive) {
        // Remove live symbol if a channel stopped being live
        if (channel.name.endsWith(liveSymbol)) {
          try {
            await channel.setName(
              channel.name.substr(0, channel.name.length - liveSymbol.length),
            );
          } catch (e) {
            console.error(
              "Failed to remove live symbol from channel",
              channel.id,
              e,
            );
          }
        }
      } else if (!wasLive && isLive) {
        // Add live symbol if a channel started being live
        if (!channel.name.endsWith(liveSymbol)) {
          try {
            await channel.setName(channel.name + liveSymbol);
          } catch (e) {
            console.error(
              "Failed to add live symbol to channel",
              channel.id,
              e,
            );
          }
        }
      }
    }),
  );
}

module.exports = {
  getEventHandler: (discordClient) => {
    return (subscription, event) => {
      const eventHandler = eventHandlers[subscription.type];
      if (!eventHandler) {
        console.error(
          `Missing event handler for subscription type "${subscription.type}"`,
        );
        return;
      }
      eventHandler(discordClient, subscription, event);
    };
  },
};
