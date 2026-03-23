// src/runtime/terminal/run-approval-loop.cjs
// Minimal watcher-like loop WITHOUT real stdin/execution.
// Feeds provided inputs sequentially.

const { createApprovalFlowState } = require("./create-approval-flow-state.cjs");

/**
 * @param {Object} step
 * @param {string[]} inputs - simulated user inputs in order
 * @returns {{
 *   finalState: string,
 *   history: Array<{prompt:string, decision:string, nextState:string}>
 * }}
 */
function runApprovalLoop(step = {}, inputs = []) {
  const history = [];

  // initial render (no input yet)
  let state = createApprovalFlowState(step, undefined);
  history.push(state);

  for (const input of inputs) {
    state = createApprovalFlowState(step, input);
    history.push(state);

    if (state.nextState === "approved") {
      return { finalState: "approved", history };
    }
    if (state.nextState === "denied_by_user") {
      return { finalState: "denied_by_user", history };
    }
    if (state.nextState === "aborted_by_user") {
      return { finalState: "aborted_by_user", history };
    }
  }

  return { finalState: "awaiting_approval", history };
}

module.exports = { runApprovalLoop };
