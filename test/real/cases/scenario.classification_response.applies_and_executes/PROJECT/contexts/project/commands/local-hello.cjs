/* path: contexts/project/commands/local-hello.cjs */
'use strict';

module.exports = async function localHello(payload) {
  return {
    ok: true,
    command: payload.command,
    from: 'project',
  };
};
