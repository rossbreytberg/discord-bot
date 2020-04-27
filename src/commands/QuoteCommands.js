const Config = require("../Config.js");
const Discord = require("discord.js");

const LAST_RANDOM_QUOTE_BY_CHANNEL = {};

async function randomQuote(message) {
  const {
    DISCORD_MESSAGE_CACHE_MAX_SIZE,
    DISCORD_MESSAGE_FETCH_LIMIT,
  } = Config.get();
  const { channel } = message;
  channel.startTyping();
  console.log(
    `Finding a random quote. Message cache contains ${channel.messages.cache.size} messages.`,
  );
  try {
    // Try to fetch messages
    let earliestMessageID = null;
    while (channel.messages.cache.size < DISCORD_MESSAGE_CACHE_MAX_SIZE) {
      const batch = await channel.messages.fetch(
        {
          before: earliestMessageID,
          limit: DISCORD_MESSAGE_FETCH_LIMIT,
        },
        /*cache*/ true,
      );
      earliestMessageID = batch.lastKey();
      // If reached the beginning of the channel, stop fetching batches
      if (batch.size < DISCORD_MESSAGE_FETCH_LIMIT) {
        break;
      }
    }
  } catch (e) {
    console.error("Failed to fetch messages for random quote: ", e);
    await channel.stopTyping();
    await channel.send(
      "The archives seem to be malfunctioning. Try again later.",
    );
    return;
  }
  // Try to get an interesting random message
  const messageCollection = channel.messages.cache.clone();
  let randomMessage = messageCollection.random();
  while (messageCollection.size > 1) {
    if (!isMessageInteresting(randomMessage)) {
      messageCollection.delete(randomMessage.id);
      randomMessage = messageCollection.random();
    } else {
      break;
    }
  }
  LAST_RANDOM_QUOTE_BY_CHANNEL[channel.id] = randomMessage;
  await channel.stopTyping();
  await channel.send(
    `Here is something interesting from the archives:\n>>> ${randomMessage.cleanContent}`,
  );
}

async function randomQuoteAuthor(message) {
  const { channel } = message;
  const quote = LAST_RANDOM_QUOTE_BY_CHANNEL[channel.id];
  if (quote) {
    const embed = new Discord.MessageEmbed()
      .setAuthor(quote.author.username, quote.author.displayAvatarURL())
      .setDescription(`${quote.cleanContent}\n\n[See Context](${quote.url})`)
      .setURL(quote.url)
      .setTimestamp(new Date(quote.createdTimestamp));
    await channel.send(
      `**${quote.author.username}** originally said that brilliant quote.`,
      embed,
    );
    return;
  }
  await channel.send("I don't remember sharing a quote recently.");
}

function isMessageInteresting(message) {
  // Cannot be by this bot
  if (message.author.id === message.client.user.id) {
    return false;
  }
  // Cannot have attachments
  if (message.attachments && message.attachments.size > 0) {
    return false;
  }
  // Cannot have embeds
  if (message.embeds.length > 0) {
    return false;
  }
  // Cannot have links
  if (
    message.cleanContent.includes("http") ||
    message.cleanContent.includes("www")
  ) {
    return false;
  }
  // Cannot have mentions
  if (message.mentions.users.size > 0) {
    return false;
  }
  // Must be at least 30 chars
  if (message.cleanContent.length < 30) {
    return false;
  }
  // Cannot have quotes
  if (message.cleanContent.includes(">>>")) {
    return false;
  }
  return true;
}

module.exports = {
  randomQuote,
  randomQuoteAuthor,
};
