/*global setTimeout */

var fs = require('fs');
var _ = require('underscore');
var hash = require('./hash');
const logger = require('../log').child({ module: 'file-util' });

module.exports = {
  // Reexport hash
  hash: hash,
  UniqueWatcher: UniqueWatcher,
  Watchers: Watchers,
};

function UniqueWatcher(custom) {
  this.logger = custom || logger;
  this.path = null;
  this.watcher = null;
}

UniqueWatcher.prototype.watch = function(path, listener, cb) {
  var self = this;
  cb = cb instanceof Function ? cb : function() { /*noop*/ };

  if (self.watcher) { self.watcher.close(); }

  setWatcher(path, rewatch, function(err, watcher) {
  // Expose the new path/watcher
    if (err) { self.logger.error('Failed to set watch for ' + path, err); }

    self.path = err ? null : path;
    self.watcher = err ? null : watcher;
    cb(err, path);
  });

  function rewatch(path, hash) {
    var watcher = self.watcher;
    if (self.watcher) { self.watcher.close(); }

    self.logger.debug('Watch triggered for ' + path);
    listener(path, hash);
    setTimeout(function() {
      // Check for interim changes
      if (self.watcher !== watcher) { return; }

      setWatcher(path, rewatch, function(err, watcher) {
        self.path = err ? null : path;
        self.watcher = err ? null : watcher;

        if (err) {
          self.logger.error('Failed to set new watch for ' + path, err);
          cb(err, path);
        }
      });
    }, 100);
  }
};

UniqueWatcher.prototype.close = function() {
  if (this.watcher) { this.watcher.close(); }
  this.path = null;
  this.watcher = null;
};

function Watchers(custom) {
  this.logger = custom || logger;
  this.watchers = {};
}

Watchers.prototype.watch = function(path, listener, cb) {
  var self = this;
  cb = cb instanceof Function ? cb : function() { /*noop*/ };

  if (self.watchers[path]) { self.watchers[path].close(); }

  setWatcher(path, rewatch, function(err, watcher) {
  // Expose the new path/watcher
    if (err) {
      self.logger.error('Failed to set watch for ' + path, err);
      delete self.watchers[path];
    } else {
      self.watchers[path] = watcher;
    }

    cb(err, path);
  });

  function rewatch(path, hash) {
    var watcher = self.watchers[path];
    if (self.watchers[path]) { self.watchers[path].close(); }

    self.logger.info('Watch triggered for ' + path);
    listener(path, hash);
    setTimeout(function() {
      // Check for interim changes
      if (self.watchers[path] !== watcher) { return; }

      setWatcher(path, rewatch, function(err, watcher) {
        if (err) {
          self.logger.error('Failed to set new watch for ' + path, err);
          delete self.watchers[path];
          cb(err, path);
        } else {
          self.watchers[path] = watcher;
        }
      });
    }, 100);
  }
};

Watchers.prototype.close = function(path) {
  if (path in this.watchers) {
    if (this.watchers[path]) { this.watchers[path].close(); }
    delete this.watchers[path];
  }
};

Watchers.prototype.closeAll = function() {
  for (var path in this.watchers) { this.close(path); }
};

function setWatcher(path, listener, cb) {
  var watcher;

  fs.stat(path, function(err, stat) {
    if (err) { return cb(err); }

    // We throttle, so we can ignore the event name, as all events will not even go through
    var listenOnce = _.debounce(_.once(function() {

      if (stat.isFile()) {
        // hash only errs if the file cannot be read, but it is already stated, so trigger anyway
        /* eslint-disable handle-callback-err */
        hash(path, function(err, hash) {
        /* eslint-enable handle-callback-err */
          listener(path, hash);
        });
      } else {
        listener(path);
      }
    }), 200);

    watcher = fs.watch(
      path,
      { persistent: false },
      listenOnce
    );

    cb(null, watcher);
  });
}

