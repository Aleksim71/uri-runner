class CommandRegistry {
  constructor() {
    this.handlers = new Map();
  }

  register(name, handler) {
    if (!name || typeof name !== 'string') {
      throw new Error('CommandRegistry.register: name must be a non-empty string');
    }

    if (typeof handler !== 'function') {
      throw new Error(`CommandRegistry.register: handler for "${name}" must be a function`);
    }

    if (this.handlers.has(name)) {
      throw new Error(`CommandRegistry.register: command "${name}" is already registered`);
    }

    this.handlers.set(name, handler);
  }

  resolve(name) {
    if (!this.handlers.has(name)) {
      throw new Error(`CommandRegistry.resolve: unknown command "${name}"`);
    }

    return this.handlers.get(name);
  }

  has(name) {
    return this.handlers.has(name);
  }

  list() {
    return Array.from(this.handlers.keys());
  }
}

module.exports = { CommandRegistry };
