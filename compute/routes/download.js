const express = require('express');
const fs = require('fs.extra');
const logger = require('../utils/log').child({ module: 'download' });

module.exports = function (app) {
  app.use('/file_download', function(req, res, next) {
    res.attachment();
    return next();
  });

  app.use('/file_download', express.static('/', {dotfiles: 'allow'}));

  // Download or get contents of a file, zipping if it's a directory
  // TODO: replace, use go to do it
  function get_download(req, res) {
    var path = decodeURIComponent(req.params.path);
    var name = path.split('/').slice(-1)[0];
    var full_path = path[0] === '/' ? path : '/' + path;

    fs.stat(full_path, function(err, stats) {
      if (err) {
        res.send(400, 'Couldn\'t get file');
        return;
      }
      if (stats.isDirectory()) {
        res.send(400, 'Cannot download directories.');
        return;
      }

      res.download(full_path, name, function(err) {
        if (err) {
          logger.error(err, 'failed download');
          // check res.headersSent to figure out if we should fail
          return;
        }
      });
    });
  }

  app.get('/download/:path', get_download);
};
