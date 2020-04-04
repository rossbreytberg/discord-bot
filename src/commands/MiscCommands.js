const DISCORD_MAX_MESSAGE_FETCH_LIMIT = 100;
const RANDOM_QUOTE_BATCHES_TO_FETCH = 50;
const RANDOM_QUOTE_MAX_TRIES = 100;

const lastRandomQuoteAuthorByChannel = {};

async function randomQuote(message) {
  await message.channel.send("Searching the archives...");
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
  lastRandomQuoteAuthorByChannel[message.channel.id] = randomMessage.author.id;
  await message.channel.stopTyping();
  await message.channel.send(
    `Here is something interesting:\n>>> ${randomMessage.cleanContent}`,
  );
}

async function randomQuoteAuthor(message) {
  const lastAuthorID = lastRandomQuoteAuthorByChannel[message.channel.id];
  if (lastAuthorID) {
    const lastAuthor = await message.client.users.resolve(lastAuthorID);
    if (lastAuthor) {
      await message.channel.send(
        `**${lastAuthor.username}** originally said that brilliant quote.`,
      );
      return;
    }
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
  // Must be at least 25 chars
  if (message.cleanContent.length < 25) {
    return false;
  }
  return true;
}

module.exports = {
  randomQuote,
  randomQuoteAuthor,
};
