const bunyan = require('bunyan');

module.exports = bunyan.createLogger({
  name: 'web-terminal',
  serializers: { err: bunyan.stdSerializers.err },
  src: true
});
