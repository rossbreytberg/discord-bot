const fs = require("fs");
const https = require("https");
const Discord = require("discord.js");
const TwitchAlertsDataStore = require("./TwitchAlertsDataStore.js");
const TwitchAPI = require("../lib/TwitchAPI.js");

const DISCORD_IMAGE_HEIGHT = 1080;
const DISCORD_IMAGE_WIDTH = 1920;
const DISCORD_THUMBNAIL_HEIGHT = 400;
const DISCORD_THUMBNAIL_WIDTH = 300;
const TWITCH_COLOR = "#6441a5";
const TWITCH_STREAM_IMAGE_FILE = "twitch-stream-image.jpg";
const TWITCH_STREAM_IMAGE_FILEPATH = `./cache/${TWITCH_STREAM_IMAGE_FILE}`;

const handlers = {
  "twitch/streams": async (discordClient, urlQuery, payload) => {
    console.log(
      "Received stream change payload from Twitch:",
      urlQuery,
      payload,
    );
    const data = payload.data[0];
    const userID = urlQuery.user_id;
    // Empty data means the stream is offline, delete all posted alerts about it
    if (!data) {
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
      // Download the stream image and send it as an attachment
      // Otherwise, it does not display correctly
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
      const richEmbed = new Discord.RichEmbed()
        .attachFile(TWITCH_STREAM_IMAGE_FILEPATH)
        .setAuthor(username, userImageUrl, userProfileUrl)
        .setColor(TWITCH_COLOR)
        .setImage(`attachment://${TWITCH_STREAM_IMAGE_FILE}`)
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
