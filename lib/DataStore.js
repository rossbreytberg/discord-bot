const fs = require("fs");

class DataStore {
  /**
   * Create new a JSON object which is backed up in a file on disk
   *
   * @param {string} filePath
   * @param {Object} defaultValue
   */
  constructor(filePath, defaultValue) {
    this.filePath = filePath;
    let fileContents = null;
    try {
      // Read the file, creating it if it does not exist
      fileContents = fs.readFileSync(filePath);
    } catch (e) {
      console.log(`DataStore file does not exist ${filePath}`);
      // If the file does not exist, create it with the default value
      fs.writeFileSync(filePath, JSON.stringify(defaultValue));
      console.log(`DataStore created file with default value at ${filePath}`);
    }
    try {
      // Read the file again, this time it should definitely exist
      fileContents = fs.readFileSync(filePath);
    } catch(e) {
      console.error(
        `DataStore failed to initialize from file "${filePath}":`,
        e,
      );
    }
    this.value = JSON.parse(fileContents);
    console.log(`DataStore initialized from file "${filePath}"`);
  }

  /**
   * Get the value of the data store
   *
   * @returns {any} value
   */
  get() {
    // Clone the value so the original cannot be mutated
    return JSON.parse(JSON.stringify(this.value));
  }

  /**
   * Update the value of the data store
   *
   * @param {any} partialValue
   */
  set(partialValue) {
    this.value = {
      ...this.value,
      ...partialValue,
    };
    fs.writeFileSync(this.filePath, JSON.stringify(this.value));
  }
}

module.exports = DataStore;
