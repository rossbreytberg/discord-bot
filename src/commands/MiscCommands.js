const Discord = require("discord.js");

const DISCORD_MAX_MESSAGE_FETCH_LIMIT = 100;
const RANDOM_QUOTE_BATCHES_TO_FETCH = 50;
const RANDOM_QUOTE_MAX_TRIES = 100;

const lastRandomQuoteByChannel = {};

async function randomQuote(message) {
  message.channel.startTyping();
  let messageCollection = null;
  let earliestMessageID = null;
  try {
    // Try to fetch and combine multiple batches of messages
    for (let i = 0; i < RANDOM_QUOTE_BATCHES_TO_FETCH; i++) {
      let batch = await message.channel.messages.fetch(
        {
          before: earliestMessageID,
          limit: DISCORD_MAX_MESSAGE_FETCH_LIMIT,
        },
        /*cache*/ false,
      );
      if (messageCollection === null) {
        messageCollection = batch;
      } else {
        messageCollection = messageCollection.concat(batch);
      }
      earliestMessageID = batch.lastKey();
      // If reached the beginning of the channel, stop fetching batches
      if (batch.size < DISCORD_MAX_MESSAGE_FETCH_LIMIT) {
        break;
      }
    }
  } catch (e) {
    console.error("Failed to fetch a random quote: ", e);
    await message.channel.stopTyping();
    await message.channel.send(
      "The archives seem to be malfunctioning. Try again later.",
    );
    return;
  }
  // Try to get an interesting random message
  let randomMessage = null;
  for (let i = 0; i < RANDOM_QUOTE_MAX_TRIES; i++) {
    if (randomMessage === null || !isMessageInteresting(randomMessage)) {
      randomMessage = messageCollection.random();
    } else {
      break;
    }
  }
  lastRandomQuoteByChannel[message.channel.id] = randomMessage;
  await message.channel.stopTyping();
  await message.channel.send(
    `Here is something interesting from the archives:\n>>> ${randomMessage.cleanContent}`,
  );
}

async function randomQuoteAuthor(message) {
  const quote = lastRandomQuoteByChannel[message.channel.id];
  if (quote) {
    const embed = new Discord.MessageEmbed()
      .setAuthor(quote.author.username, quote.author.displayAvatarURL())
      .setDescription(`${quote.cleanContent}\n\n[See Context](${quote.url})`)
      .setURL(quote.url)
      .setTimestamp(new Date(quote.createdTimestamp));
    await message.channel.send(
      `**${quote.author.username}** originally said that brilliant quote.`,
      embed,
    );
    return;
  }
  await message.channel.send("I don't remember sharing a quote recently.");
}

function isMessageInteresting(message) {
  // Cannot be by this bot
  if (message.author.id === message.client.user.id) {
    return false;
  }
  // Cannot have embeds
  if (message.embeds) {
    return false;
  }
  // Cannot have attachments
  if (message.attachments && message.attachments.keyArray().length > 0) {
    return false;
  }
  // Cannot have links
  if (
    message.cleanContent.includes("http") ||
    message.cleanContent.includes("www")
  ) {
    return false;
  }
  // Must be at least 30 chars
  if (message.cleanContent.length < 30) {
    return false;
  }
  return true;
}

module.exports = {
  randomQuote,
  randomQuoteAuthor,
};
