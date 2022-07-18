/* global before */

const logger = require('../utils/log');
const bunyan = require('bunyan');

before(() => {
  logger.level(bunyan.FATAL + 1); // Turn off logging during tests
});
