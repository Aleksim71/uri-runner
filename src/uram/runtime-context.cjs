"use strict";

function createRuntimeContext({ cwd, logger, state, registry }) {
  return {
    cwd,
    logger,
    state: state || { steps: {} },
    registry,
  };
}

module.exports = { createRuntimeContext };
