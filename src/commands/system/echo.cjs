module.exports = async function echoCommand(args = {}, context = {}) {
  const message = args.message ?? 'EMPTY';
  const logger = context.logger ?? console;

  if (typeof logger.log === 'function') {
    logger.log(message);
  }

  return {
    ok: true,
    code: 0,
    data: {
      message,
    },
  };
};
