'use strict';

/**
 * URI Runner
 * Execution Event Bus
 *
 * Minimal synchronous event bus for runtime execution events.
 *
 * Design rules:
 * - events are immutable
 * - subscribers are synchronous
 * - subscribers must not mutate events
 * - emit fails fast if any subscriber throws
 */

function createExecutionEventBus() {
  const subscribers = new Map();
  let nextSubscriberId = 1;

  function subscribe(handler) {
    if (typeof handler !== 'function') {
      throw new Error(
        'execution-event-bus: subscribe handler must be a function'
      );
    }

    const id = String(nextSubscriberId++);
    subscribers.set(id, handler);

    return function unsubscribe() {
      subscribers.delete(id);
    };
  }

  function emit(event) {
    validateEvent(event);

    const immutableEvent = freezeEvent(event);

    for (const handler of subscribers.values()) {
      handler(immutableEvent);
    }

    return immutableEvent;
  }

  function getSubscriberCount() {
    return subscribers.size;
  }

  function clear() {
    subscribers.clear();
  }

  return {
    subscribe,
    emit,
    getSubscriberCount,
    clear
  };
}

function freezeEvent(event) {
  const cloned = clonePlainObject(event);

  if (Object.prototype.hasOwnProperty.call(cloned, 'meta')) {
    cloned.meta = freezeNestedValue(cloned.meta);
  }

  if (Object.prototype.hasOwnProperty.call(cloned, 'payload')) {
    cloned.payload = freezeNestedValue(cloned.payload);
  }

  return Object.freeze(cloned);
}

function freezeNestedValue(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeNestedValue(item)));
  }

  if (isPlainObject(value)) {
    const output = {};

    for (const [key, nested] of Object.entries(value)) {
      output[key] = freezeNestedValue(nested);
    }

    return Object.freeze(output);
  }

  return value;
}

function clonePlainObject(value) {
  const output = {};

  for (const [key, nested] of Object.entries(value)) {
    output[key] = nested;
  }

  return output;
}

function isPlainObject(value) {
  return value != null &&
    typeof value === 'object' &&
    !Array.isArray(value);
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error(
      'execution-event-bus: emitted event must be an object'
    );
  }

  if (typeof event.type !== 'string' || event.type.trim() === '') {
    throw new Error(
      'execution-event-bus: event.type must be a non-empty string'
    );
  }
}

module.exports = {
  createExecutionEventBus
};
