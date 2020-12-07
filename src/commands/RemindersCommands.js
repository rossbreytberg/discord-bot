const Config = require("../Config.js");
const Discord = require("discord.js");
const RemindersDataStore = require("./../RemindersDataStore.js");
const Time = require("../../lib/Time.js");

async function viewReminders(message) {
  const reminders = RemindersDataStore.getRemindersForChannel(
    message.channel.id,
  );
  if (reminders.length === 0) {
    await message.channel.send("This channel does not have any reminders set.");
    return;
  }
  let response = "Here are the reminders for this channel:";
  for (let i = 0; i < reminders.length; i++) {
    const reminder = reminders[i];
    const reminderText = await getReminderText(message, reminder);
    response += `\n${i + 1}) Reminding ${reminderText}`;
  }
  await message.channel.send(response);
}

async function addReminder(message, input) {
  const lowercaseInput = input.toLowerCase();
  const contentStartIdx = lowercaseInput.indexOf(" to ");
  const timeStartIdx = Math.max(
    lowercaseInput.lastIndexOf(" at "),
    lowercaseInput.lastIndexOf(" in "),
  );
  if (contentStartIdx === -1 || timeStartIdx === -1) {
    await message.channel.send(
      "Your reminder is formatted incorrectly. Say something like `remind <user> to <do something> in <time amount>` or `remind <user> to <do something> at <time>`.",
    );
    return;
  }

  const target = await getTargetFromText(
    message,
    input.substring(0, contentStartIdx),
  );
  if (target === null) {
    await message.channel.send(`Unclear who to remind. Try mentioning them.`);
    return;
  }
  const content = input.substring(
    contentStartIdx + String(" to ").length,
    timeStartIdx,
  );
  const timestamp = Time.getTimeFromText(input.substring(timeStartIdx + 1)); // +1 to remove starting space
  if (timestamp === null) {
    await message.channel.send("Reminder time is invalid.");
    return;
  }
  const { REMINDERS_CHECK_INTERVAL_SECONDS } = Config.get();
  if (timestamp - Date.now() < REMINDERS_CHECK_INTERVAL_SECONDS * 1000) {
    await message.channel.send("Reminder must be further in the future.");
    return;
  }

  const reminder = {
    content,
    timestamp,
    target,
  };
  RemindersDataStore.addReminderForChannel(message.channel.id, reminder);
  const reminderText = await getReminderText(message, reminder);
  await message.channel.send(`Created a reminder for ${reminderText}.`);
}

async function removeReminder(message, reminderNum) {
  const reminderIdx = reminderNum - 1;
  const reminder = RemindersDataStore.removeReminderForChannel(
    message.channel.id,
    reminderIdx,
  );
  if (reminder == null) {
    await message.channel.send("There is no reminder with that number.");
  }
  const reminderText = await getReminderText(message, reminder);
  await message.channel.send(`Cleared reminder for ${reminderText}.`);
}

async function getReminderText(message, reminder) {
  const { content, target, timestamp } = reminder;
  let targetName = "Unknown";
  switch (target.type) {
    case "role":
      const role = await message.channel.guild.roles.fetch(target.id);
      if (role) {
        targetName = role.name;
      }
      break;
    case "user":
      switch (message.channel.type) {
        case "dm":
          targetName = message.channel.recipient.username;
          break;
        case "text":
          const member = message.channel.members.get(target.id);
          if (member) {
            targetName = member.user.username;
          }
      }
      break;
  }
  const date = new Date(timestamp);
  const dateNow = new Date(Date.now());
  const sameDay =
    date.getDate() === dateNow.getDate() &&
    date.getMonth() === dateNow.getMonth() &&
    date.getFullYear() === dateNow.getFullYear();
  return `**${targetName}** to **${content}** ${sameDay ? "at" : "on"} **${
    sameDay
      ? date.toLocaleTimeString([], { timeStyle: "short" })
      : date.toLocaleString([], { dateStyle: "short", timeStyle: "short" })
  }**`;
}

async function getTargetFromText(message, targetText) {
  // If already a mention, keep as is
  if (Discord.MessageMentions.ROLES_PATTERN.test(targetText)) {
    return {
      id: targetText.replace(/\D/g, ""),
      type: "role",
    };
  }
  if (Discord.MessageMentions.USERS_PATTERN.test(targetText)) {
    return {
      id: targetText.replace(/\D/g, ""),
      type: "user",
    };
  }
  if (targetText.startsWith("@")) {
    targetText = targetText.substring(1);
  }
  const [name, discriminator] = targetText.split("#");
  // If message sender uses a personal pronoun or
  // this is a DM and the sender uses their own name
  // then they are the target
  if (
    targetText === "me" ||
    targetText === "myself" ||
    (message.channel.type === "dm" &&
      message.channel.recipient.username
        .toLowerCase()
        .includes(name.toLowerCase()))
  ) {
    return { id: message.author.id, type: "user" };
  }
  // If this is a DM and there was no username match above, no valid target
  if (message.channel.type == "dm") {
    return null;
  }
  // Try to search for channel members with the given name (and discriminator if one was provided)
  const matchingMembers = message.channel.members.filter(
    (member) =>
      member.user.username.toLowerCase() === name.toLowerCase() &&
      (member.user.discriminator === discriminator ||
        discriminator === undefined),
  );
  if (matchingMembers.size > 1) {
    // If more than one user matches, user will see an error message
    return null;
  }
  if (matchingMembers.size === 1) {
    return { id: matchingMembers.first().user.id, type: "user" };
  }
  // If no matching user, search for roles with the given name
  const roles = await message.channel.guild.roles.fetch();
  const matchingRoles = roles.cache.filter(
    (role) =>
      role.mentionable &&
      role.name.toLowerCase() === name.toLowerCase() &&
      discriminator === undefined,
  );
  if (matchingRoles.size === 1) {
    return { id: matchingRoles.first().id, type: "role" };
  }
  // If no matching user or role, do a more relaxed search for user
  if (discriminator === undefined) {
    const matchingMembers = message.channel.members.filter((member) =>
      member.user.username.toLowerCase().includes(name.toLowerCase()),
    );
    if (matchingMembers.size === 1) {
      return { id: matchingMembers.first().user.id, type: "user" };
    }
  }
  // No match found, user will see an error
  return null;
}

module.exports = {
  viewReminders,
  addReminder,
  removeReminder,
};
