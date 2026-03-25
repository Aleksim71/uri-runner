// path: test/unit/compile-plan.browser.test.mjs

import { describe, expect, test } from 'vitest';
import { compileBrowserFlow } from '../../src/uram/compile-browser-flow.cjs';

function compilePlanForBrowserOnly(runbook = {}) {
  const plan = {
    steps: []
  };

  const browserSteps = compileBrowserFlow(runbook.browser);
  plan.steps.push(...browserSteps);

  return plan;
}

describe('compile plan browser integration contract', () => {
  test('includes compiled browser steps in plan.steps', () => {
    const plan = compilePlanForBrowserOnly({
      browser: {
        flow: [
          { action: 'session.start' },
          { action: 'page.open', url: 'https://example.com' },
          { action: 'page.wait', waitUntil: 'networkidle' },
          { action: 'diagnostics.collect' },
          { action: 'session.stop' }
        ]
      }
    });

    expect(plan.steps.map((step) => step.name)).toEqual([
      'browser.session.start',
      'browser.page.open',
      'browser.page.wait',
      'browser.diagnostics.collect',
      'browser.session.stop'
    ]);

    expect(plan.steps[1]).toEqual({
      id: null,
      name: 'browser.page.open',
      input: { url: 'https://example.com' }
    });
  });

  test('preserves browser step order in compiled plan', () => {
    const plan = compilePlanForBrowserOnly({
      browser: {
        flow: [
          { action: 'session.stop' },
          { action: 'diagnostics.collect' },
          { action: 'session.start' }
        ]
      }
    });

    expect(plan.steps.map((step) => step.name)).toEqual([
      'browser.session.stop',
      'browser.diagnostics.collect',
      'browser.session.start'
    ]);
  });

  test('does not add browser steps when browser section is missing', () => {
    const plan = compilePlanForBrowserOnly({});
    expect(plan.steps).toEqual([]);
  });

  test('throws when browser flow is invalid', () => {
    expect(() =>
      compilePlanForBrowserOnly({
        browser: {
          flow: [{ action: 'page.open' }]
        }
      })
    ).toThrow('Browser flow item at index 0 with action page.open must include url.');
  });
});
