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
const TWITCH_STREAM_IMAGE_FILE = "twitch-stream-image.jpg";
const TWITCH_STREAM_IMAGE_FILEPATH = `${CACHE_PATH}/cache/${TWITCH_STREAM_IMAGE_FILE}`;

const handlers = {
  "twitch/streams": async (discordClient, urlQuery, payload) => {
    console.log(
      "Received stream change payload from Twitch:",
      urlQuery,
      payload,
    );
    const data = payload.data[0];
    const userID = urlQuery.user_id;
    const liveChannelsBefore = TwitchAlertsDataStore.getLiveChannels();
    // Remove existing messages for user, if there are any
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
    // Empty data means the stream is offline
    // Deleted all the messages above already
    // Just need to clear any live symbols for channels that stopped being live
    if (!data) {
      const liveChannelsAfter = TwitchAlertsDataStore.getLiveChannels();
      await updateChannelLiveSymbols(
        discordClient,
        liveChannelsBefore,
        liveChannelsAfter,
      );
      return;
    }
    const {
      game_id: gameID,
      thumbnail_url: streamImageUrl,
      title,
      type,
      user_name: username,
    } = data;
    if (type === "live") {
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
        const streamImageFile = fs.createWriteStream(
          TWITCH_STREAM_IMAGE_FILEPATH,
        );
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
      const liveChannelsAfter = TwitchAlertsDataStore.getLiveChannels();
      await updateChannelLiveSymbols(
        discordClient,
        liveChannelsBefore,
        liveChannelsAfter,
      );
    }
  },
};

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
  getHandlers: (discordClient) => {
    const handlersWithBind = {};
    Object.keys(handlers).forEach(
      (key) =>
        (handlersWithBind[key] = handlers[key].bind(this, discordClient)),
    );
    return handlersWithBind;
  },
};
