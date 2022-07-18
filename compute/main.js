/*global process */

const logger = require('./utils/log').child({ module: 'main' });
const makeServer = require('./server.js');

const { server } = makeServer();

logger.info('Starting instrumenting module.');

const port = 8282;

server.listen(port, function () {
  logger.info({ port }, 'Listening.');
});

process.on('exit', function() {
  logger.info('Server exiting.');
});
