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
    // Remove existing messages for user, if there are any
    const messageIDs = TwitchAlertsDataStore.getMessages(userID);
    await Promise.all(
      messageIDs.map(async messageID => {
        await Promise.all(
          discordClient.channels.map(async channel => {
            try {
              const message = await channel.fetchMessage(messageID);
              if (message) {
                await message.delete();
              }
            } catch (error) {}
          }),
        );
      }),
    );
    TwitchAlertsDataStore.removeMessages(userID);
    // Empty data means the stream is offline, do nothing since we already
    // deleted all the messages about it above
    if (!data) {
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
      const content = `**${username}** has started streaming on Twitch!`;
      const gameName = gameInfo && gameInfo.name;
      const gameImageUrl = gameInfo && gameInfo.box_art_url;
      const userImageUrl = userInfo && userInfo.profile_image_url;
      const userProfileUrl = TwitchAPI.getUserProfileUrl(username);
      const richEmbed = new Discord.RichEmbed()
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
        await new Promise(resolve => {
          https.get(
            streamImageUrl
              .replace("{height}", DISCORD_IMAGE_HEIGHT)
              .replace("{width}", DISCORD_IMAGE_WIDTH),
            response => {
              const download = response.pipe(streamImageFile);
              download.on("close", resolve);
            },
          );
        });
        richEmbed
          .attachFile(TWITCH_STREAM_IMAGE_FILEPATH)
          .setImage(`attachment://${TWITCH_STREAM_IMAGE_FILE}`);
      }
      const messageIDs = [];
      const channelIDsToAlert = TwitchAlertsDataStore.getChannels();
      await Promise.all(
        discordClient.channels.map(async channel => {
          if (
            channel.type === "text" &&
            channelIDsToAlert.includes(channel.id)
          ) {
            const message = await channel.send(content, richEmbed);
            messageIDs.push(message.id);
          }
        }),
      );
      TwitchAlertsDataStore.addMessages(userID, messageIDs);
    }
  },
};

module.exports = {
  getHandlers: discordClient => {
    const handlersWithBind = {};
    Object.keys(handlers).forEach(
      key => (handlersWithBind[key] = handlers[key].bind(this, discordClient)),
    );
    return handlersWithBind;
  },
};
