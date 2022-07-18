const daemon = require('./daemon');
const ports = require('./ports');
const terminal = require('./terminal');
const download = require('./download');
const editor = require('./editor');
const files = require('./files');

module.exports = function (app, server) {
  daemon(app, server);
  ports(app, server);
  terminal(app, server);
  download(app, server);
  editor(app, server);
  files(app, server);
};
