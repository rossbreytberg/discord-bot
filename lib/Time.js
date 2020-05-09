const SEC_IN_MS = 1000;
const MIN_IN_MS = SEC_IN_MS * 60;
const HOUR_IN_MS = MIN_IN_MS * 60;
const DAY_IN_MS = HOUR_IN_MS * 24;
const WEEK_IN_MS = DAY_IN_MS * 7;
const YEAR_IN_MS = DAY_IN_MS * 365;

/**
 * Converts text representing time into a timestamp if possible
 *
 * @param {string} text
 * @returns {?number} timestamp
 */
function getTimeFromText(text) {
  const dividerIdx = text.indexOf(" ");
  const type = text.substring(0, dividerIdx).toLowerCase();
  const value = text.substring(dividerIdx + 1);
  switch (type) {
    case "at":
      return getTimeFromAbsoluteText(value);
    case "in":
      return getTimeFromRelativeText(value);
  }
  return null;
}

/**
 * Converts absolute time text, such as "1:05" or "6pm" to a timestamp
 *
 * @param {string} text
 * @returns {?number} timestamp
 */
function getTimeFromAbsoluteText(text) {
  // Extract hours, minutes, and period from the text
  let [hours, minutes = 0] = text.split(":").map((num) => Number.parseInt(num));
  let period = null;
  text = text.toLowerCase();
  const hasAM = text.includes("am");
  const hasPM = text.includes("pm");
  // Cannot specify both AM and PM
  if (hasAM && hasPM) {
    return null;
  }
  // Cannot specify either AM or PM when using military time
  if ((hasAM || hasPM) && hours > 12) {
    return null;
  }
  // Convert to military time
  if ((hasAM && hours === 12) || (hasPM && hours !== 12)) {
    hours = (hours + 12) % 24;
  }
  // Adjust by 12 or 24 hours ahead if the time already passed today
  let nextDay = false;
  const currentTime = Date.now();
  if (isTimePassedToday(currentTime, hours, minutes)) {
    if (
      !hasAM &&
      !hasPM &&
      hours !== 0 &&
      hours < 12 &&
      !isTimePassedToday(currentTime, hours + 12, minutes)
    ) {
      // If AM/PM was unspecified, and the hours number is not 0 or more than 12, time is ambiguous
      // If the PM version of the time has not happened yet, interpret it as such and adjust 12 hours
      hours += 12;
    } else {
      // Else just skip to tomorrow
      nextDay = true;
    }
  }
  const reminderDate = new Date(currentTime + (nextDay ? DAY_IN_MS : 0));
  reminderDate.setHours(hours, minutes);
  return reminderDate.valueOf();
}

/**
 * Converts relative time text such as to a timestamp
 * For example, "5 minutes" would be a timestamp 5 minutes in the future
 *
 * @param {string} text
 * @returns {?number} timestamp
 */
function getTimeFromRelativeText(text) {
  const amount = Number.parseFloat(text);
  const unit = text.substring(String(amount).length);
  const multiplier = getUnitInMS(unit);
  if (multiplier === null) {
    return null;
  }
  return Date.now() + amount * multiplier;
}

/**
 * Takes in the current timestamp and the hours and minutes of a military time
 * Returns true if the military time has already occurred today
 *
 * @param {number} currentTime
 * @param {number} hours
 * @param {number} minutes
 */
function isTimePassedToday(currentTime, hours, minutes) {
  const currentDate = new Date(currentTime);
  return (
    currentDate.getHours() > hours ||
    (currentDate.getHours() === hours && currentDate.getMinutes() > minutes)
  );
}

/**
 * Converts a text unit to a number of milliseconds
 *
 * @param {string} unit
 * @returns {?number} ms
 */
function getUnitInMS(unit) {
  unit = unit.toLowerCase().trim();
  switch (unit) {
    case "s":
    case "sec":
    case "secs":
    case "second":
    case "seconds":
      return SEC_IN_MS;
    case "m":
    case "min":
    case "mins":
    case "minute":
    case "minutes":
      return MIN_IN_MS;
    case "h":
    case "hr":
    case "hrs":
    case "hour":
    case "hours":
      return HOUR_IN_MS;
    case "d":
    case "day":
    case "days":
      return DAY_IN_MS;
    case "w":
    case "wk":
    case "wks":
    case "week":
    case "weeks":
      return WEEK_IN_MS;
    case "y":
    case "yr":
    case "yrs":
    case "year":
    case "years":
      return YEAR_IN_MS;
    default:
      return null;
  }
}

module.exports = {
  getTimeFromText,
};
