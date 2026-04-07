/* path: src/runtime/command-registry/read-classification-response.cjs */
"use strict";

const fs = require("fs-extra");
const path = require("path");
const YAML = require("yaml");

const RESPONSE_FILE_NAMES = [
  "CLASSIFICATION_RESPONSE.yaml",
  "CLASSIFICATION_RESPONSE.yml",
  "CLASSIFICATION_RESPONSE.json",
  "classification-response.yaml",
  "classification-response.yml",
  "classification-response.json",
];

async function readClassificationResponse(inboxDir) {
  if (typeof inboxDir !== "string" || !inboxDir.trim()) {
    return null;
  }

  for (const fileName of RESPONSE_FILE_NAMES) {
    const filePath = path.join(inboxDir, fileName);

    if (!(await fs.pathExists(filePath))) {
      continue;
    }

    const raw = await fs.readFile(filePath, "utf8");
    const value = fileName.endsWith(".json") ? JSON.parse(raw) : YAML.parse(raw);

    return {
      fileName,
      filePath,
      raw,
      value,
    };
  }

  return null;
}

module.exports = {
  RESPONSE_FILE_NAMES,
  readClassificationResponse,
};
