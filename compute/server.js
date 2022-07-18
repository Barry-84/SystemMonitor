/*global process */

const http = require('http');
const express = require('express');
const expressWs = require('express-ws');
const Promise = require('bluebird');

const routes = require('./routes');

const logger = require('./utils/log').child({ module: 'server' });

process.on('uncaughtException', function(err) {
  logger.error(err, 'UNCAUGHT EXCEPTION');
});

Promise.config({
  warnings: true,
  longStackTraces: true
});

process.on('unhandledRejection', (err) => {
  logger.error(err, 'Unhandled promise rejection.');
});

module.exports = function () {
  const app = express();
  const server = http.createServer(app);

  expressWs(app, server);

  // Configure logging
  app.set('showStackError', true);

  app.use(require('express-bunyan-logger')({
    format: ':status-code :method :url - :remote_address :user-agent in :response-time',
    excludes: ['req', 'res', 'res-headers', 'user-agent'],
    logger: logger.child({ module: 'express-server' })
  }));

  app.use(require('express-bunyan-logger').errorLogger({
    format: 'ERROR! :status-code :method :url - :remote_address :user-agent in :response-time',
    logger: logger.child({ module: 'express-server' })
  }));

  // Add cors
  app.use((req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': req.headers.origin,
      'Access-Control-Allow-Headers': req.header('Access-Control-Request-Headers'),
      'Access-Control-Allow-Method': req.header('Access-Control-Request-Method'),
      'Access-Control-Allow-Credentials': true,
    });

    next();
  });

  app.get('/version', (req, res) => {
    res.send(200, JSON.stringify({ major: '2' }));
  });

  // Add routes
  routes(app, server);

  return { app, server };
};
