const fs = require("fs");

const DEFAULT_CONFIG_PATH = "./config.json";

let config = null;

function get() {
  if (config !== null) {
    return config;
  }
  const configPathOverride = process.argv[2];
  return JSON.parse(fs.readFileSync(configPathOverride || DEFAULT_CONFIG_PATH));
}

module.exports = {
  get,
};
