// src/runtime/terminal/normalize-approval-input.cjs
function normalizeApprovalInput(input = "") {
  const value = String(input).trim().toLowerCase();

  if (value === "" || value === "y") {
    return "approve";
  }

  if (value === "n") {
    return "deny";
  }

  if (value === "q") {
    return "abort";
  }

  return "invalid";
}

module.exports = {
  normalizeApprovalInput,
};
