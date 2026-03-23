// src/runtime/terminal/run-approval-stdin.cjs
const readline = require("readline");
const { createApprovalFlowState } = require("./create-approval-flow-state.cjs");

function runApprovalWithStdin(step = {}, options = {}) {
  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  const promptPrefix = options.promptPrefix || "> ";

  const rl = readline.createInterface({
    input,
    output,
  });

  return new Promise((resolve) => {
    function ask() {
      const state = createApprovalFlowState(step);
      output.write(`${state.prompt}\n`);

      rl.question(promptPrefix, (answer) => {
        const next = createApprovalFlowState(step, answer);

        if (next.nextState === "awaiting_approval") {
          output.write("\nInvalid input. Try again.\n\n");
          return ask();
        }

        rl.close();
        resolve(next);
      });
    }

    ask();
  });
}

module.exports = {
  runApprovalWithStdin,
};
