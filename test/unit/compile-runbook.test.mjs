import { describe, expect, it } from 'vitest';
import {
  compileRunbookObject
} from '../../src/runtime/compile-runbook.cjs';

describe('compile-runbook', () => {
  it('compiles a valid runbook object into PLAN v1', () => {
    const plan = compileRunbookObject({
      receiver: 'uri',
      project: 'demo',
      goal: 'Inspect index file and verify expected output',
      max_attempts: 2,
      provide: [
        'src/index.js',
        {
          path: 'package.json',
          action: 'file.read',
          reason: 'Need dependencies'
        }
      ],
      modify: [
        {
          path: 'src/index.js',
          instructions: 'Fix exported symbol'
        }
      ],
      goal_checks: [
        'exports the expected function',
        {
          text: 'tests pass'
        }
      ]
    }, {
      source: 'RUNBOOK.yaml'
    });

    expect(plan).toEqual({
      version: 1,
      source: {
        type: 'runbook',
        path: 'RUNBOOK.yaml'
      },
      receiver: 'uri',
      project: 'demo',
      goal: 'Inspect index file and verify expected output',
      maxAttempts: 2,
      steps: [
        {
          type: 'provide',
          action: 'file.read',
          payload: {
            path: 'src/index.js'
          }
        },
        {
          type: 'provide',
          action: 'file.read',
          payload: {
            path: 'package.json',
            reason: 'Need dependencies'
          }
        },
        {
          type: 'modify',
          action: 'file.patch',
          payload: {
            path: 'src/index.js',
            instructions: 'Fix exported symbol'
          }
        },
        {
          type: 'check',
          action: 'goal.check',
          payload: {
            text: 'exports the expected function'
          }
        },
        {
          type: 'check',
          action: 'goal.check',
          payload: {
            text: 'tests pass'
          }
        }
      ]
    });
  });

  it('defaults maxAttempts to 1 and empty arrays to no steps', () => {
    const plan = compileRunbookObject({
      receiver: 'uri',
      project: 'demo',
      goal: 'Do one deterministic thing'
    });

    expect(plan.maxAttempts).toBe(1);
    expect(plan.steps).toEqual([]);
  });

  it('rejects foreign receiver', () => {
    expect(() => {
      compileRunbookObject({
        receiver: 'other-agent',
        project: 'demo',
        goal: 'Should fail'
      });
    }).toThrow(/receiver must be "uri"/i);
  });

  it('rejects empty goal', () => {
    expect(() => {
      compileRunbookObject({
        receiver: 'uri',
        project: 'demo',
        goal: '   '
      });
    }).toThrow(/runbook\.goal must not be empty/i);
  });

  it('rejects absolute paths in provide steps', () => {
    expect(() => {
      compileRunbookObject({
        receiver: 'uri',
        project: 'demo',
        goal: 'Reject unsafe paths',
        provide: ['/etc/passwd']
      });
    }).toThrow(/project-relative path/i);
  });

  it('rejects path traversal in modify steps', () => {
    expect(() => {
      compileRunbookObject({
        receiver: 'uri',
        project: 'demo',
        goal: 'Reject unsafe paths',
        modify: ['../secrets.txt']
      });
    }).toThrow(/must not escape project root/i);
  });

  it('normalizes backslashes in project-relative paths', () => {
    const plan = compileRunbookObject({
      receiver: 'uri',
      project: 'demo',
      goal: 'Normalize paths',
      provide: ['src\\index.js']
    });

    expect(plan.steps).toEqual([
      {
        type: 'provide',
        action: 'file.read',
        payload: {
          path: 'src/index.js'
        }
      }
    ]);
  });

  it('rejects non-array provide field', () => {
    expect(() => {
      compileRunbookObject({
        receiver: 'uri',
        project: 'demo',
        goal: 'Bad shape',
        provide: 'src/index.js'
      });
    }).toThrow(/runbook\.provide must be an array/i);
  });
});
