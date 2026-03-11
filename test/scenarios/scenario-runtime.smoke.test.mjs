import { describe, expect, it } from 'vitest';

import { CommandRegistry } from '../../src/commands/command-registry.cjs';
import { parseScenario } from '../../src/uram/scenario-parser.cjs';
import { executeScenario } from '../../src/uram/scenario-executor.cjs';

import echoCommand from '../../src/commands/system/echo.cjs';

describe('scenario runtime smoke', () => {
  it('executes a simple happy path scenario through registry -> parser -> executor', async () => {
    const registry = new CommandRegistry();
    registry.register('system.echo', echoCommand);

    const scenarioDoc = {
      scenario: {
        start: 'step_1',
      },
      steps: [
        {
          id: 'step_1',
          command: 'system.echo',
          args: { message: 'hello' },
          on_success: 'step_2',
        },
        {
          id: 'step_2',
          command: 'system.echo',
          args: { message: 'done' },
          stop: true,
        },
      ],
    };

    const parsed = parseScenario(scenarioDoc);

    const logs = [];
    const logger = {
      log(value) {
        logs.push(value);
      },
    };

    const result = await executeScenario(parsed, {
      registry,
      context: {
        logger,
        state: { steps: {} },
      },
      maxSteps: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.finished).toBe(true);
    expect(result.stopReason).toBe('stop_flag');
    expect(result.currentStepId).toBe('step_2');
    expect(result.visitedSteps).toEqual(['step_1', 'step_2']);

    expect(result.state.steps.step_1).toMatchObject({
      ok: true,
      code: 0,
      data: { message: 'hello' },
    });

    expect(result.state.steps.step_2).toMatchObject({
      ok: true,
      code: 0,
      data: { message: 'done' },
    });

    expect(logs).toEqual(['hello', 'done']);
  });
});
