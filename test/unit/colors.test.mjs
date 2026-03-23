// path: test/unit/colors.test.mjs

import { describe, expect, it } from 'vitest';
import {
  colorizeQueueState,
  createTerminalPalette,
  formatQueueMessage,
} from '../../src/runtime/terminal/colors.cjs';

describe('colors', () => {
  it('colorizes a failed state badge when colors are enabled', () => {
    const palette = createTerminalPalette({ enabled: true });
    const text = colorizeQueueState('failed', '[FAILED]', { palette });

    expect(text).toContain('\u001b[');
    expect(text).toContain('[FAILED]');
  });

  it('formats a queue message with badge, label and detail', () => {
    const palette = createTerminalPalette({ enabled: true });
    const message = formatQueueMessage(
      {
        state: 'queued',
        label: 'watch task accepted',
        detail: 'runId=abc123',
      },
      { palette }
    );

    expect(message).toContain('[QUEUED]');
    expect(message).toContain('watch task accepted');
    expect(message).toContain('runId=abc123');
  });
});
