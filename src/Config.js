const fs = require("fs");

const DEFAULT_CONFIG_PATH = "../config.json";

let config = fs.readFileSync(DEFAULT_CONFIG_PATH);

function overridePath(path) {
  config = fs.readFileSync(path);
}

function get() {
  return config;
}

module.exports = {
  get,
  overridePath,
};