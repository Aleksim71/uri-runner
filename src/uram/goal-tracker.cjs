/* path: src/uram/goal-tracker.cjs */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function buildGoalKey(goalTitle) {
  if (typeof goalTitle !== "string") return "";
  return goalTitle.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function resolveGoalTitle(runbook) {
  if (typeof runbook?.goalTitle === "string" && runbook.goalTitle.trim()) {
    return runbook.goalTitle.trim();
  }
  if (typeof runbook?.goal === "string" && runbook.goal.trim()) {
    return runbook.goal.trim();
  }
  if (typeof runbook?.title === "string" && runbook.title.trim()) {
    return runbook.title.trim();
  }
  return "Цель не указана";
}

function getStatePath(rootDir) {
  return path.join(rootDir, "runtime", "watch", "goal-state.json");
}

function readState(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeState(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function compute(rootDir, goalTitle) {
  const safeTitle =
    typeof goalTitle === "string" && goalTitle.trim()
      ? goalTitle.trim()
      : "Цель не указана";

  const goalKey = buildGoalKey(safeTitle);
  const statePath = getStatePath(rootDir);
  const prev = readState(statePath);

  let attempt = 1;
  if (
    prev &&
    typeof prev.goalKey === "string" &&
    prev.goalKey === goalKey &&
    Number.isInteger(prev.attempt) &&
    prev.attempt > 0
  ) {
    attempt = prev.attempt + 1;
  }

  return {
    goalTitle: safeTitle,
    goalKey,
    attempt,
  };
}

function persist(rootDir, goal) {
  const statePath = getStatePath(rootDir);
  writeState(statePath, {
    goalTitle: goal?.title || "",
    goalKey: goal?.key || "",
    attempt:
      Number.isInteger(goal?.attempt) && goal.attempt > 0
        ? goal.attempt
        : 1,
    updatedAt: new Date().toISOString(),
  });
}

module.exports = {
  buildGoalKey,
  resolveGoalTitle,
  compute,
  persist,
};
