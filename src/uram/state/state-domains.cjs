"use strict";

const STATE_DOMAINS = {
  files: {
    supported: true,
    verifyDefault: "ok",
  },
  workspace: {
    supported: true,
    verifyDefault: "ok",
  },
  database: {
    supported: false,
    verifyDefault: "not_checked",
  },
  environment: {
    supported: false,
    verifyDefault: "not_checked",
  },
  server: {
    supported: false,
    verifyDefault: "not_checked",
  },
};

function getStateDomains() {
  return { ...STATE_DOMAINS };
}

function getSupportedDomainNames() {
  return Object.keys(STATE_DOMAINS).filter(
    (name) => STATE_DOMAINS[name].supported === true
  );
}

module.exports = {
  STATE_DOMAINS,
  getStateDomains,
  getSupportedDomainNames,
};
