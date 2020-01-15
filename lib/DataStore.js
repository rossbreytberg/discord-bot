const fs = require("fs");

class DataStore {
  /**
   * Create a new data store which is backed up in a file on disk
   *
   * @param {string} cacheFile
   */
  constructor(cacheFile) {
    this.cacheFile = cacheFile;
    try {
      this.state = JSON.parse(fs.readFileSync(cacheFile));
    } catch (error) {
      if (error) {
        console.error(
          `DataStore failed to initialize from file "${cacheFile}"`,
        );
      } else {
        console.log(`DataStore initialized from file "${cacheFile}"`);
      }
    }
  }

  /**
   * Get a value from the data store
   *
   * @param {string} key
   * @returns {any} value
   */
  get(key) {
    // clone the value so the original cannot be mutated
    return JSON.parse(JSON.stringify(this.state[key]));
  }

  /**
   * Store a value in the data store
   *
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    this.state[key] = value;
    fs.writeFileSync(this.cacheFile, JSON.stringify(this.state));
  }
}

module.exports = DataStore;
