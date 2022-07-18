const fs = require('fs.extra');
const redux = require('redux');

const logger = require('../utils/log').child({ module: 'file-plugin' });
const file = require('../utils/file');
const Socket = require('../utils/socket');

const pathWatcher = new file.UniqueWatcher(logger);

// TODO: Move into FilesController fields
const state = {
  watched_path: '/home'
};

class FilesController {
  hello(socket, msg, cb) {
    return sendList(socket, state.watched_path, cb, { cd: true });
  }

  list(socket, msg, cb) {
    return sendList(socket, msg.path, cb, { passback: msg.passback, cd: false });
  }

  cd(socket, msg, cb) {
    return sendList(socket, msg.path, cb, { passback: msg.passback, cd: true });
  }
}

module.exports = function (app) {
  app.ws('/finder/connect', Socket.middleware(), (ws, req) => {
    const socket = req.socket;

    const controller = new FilesController();

    // Promise used to serialize all actions.
    let serializer = Promise.resolve();

    const store = redux.createStore((state = {}, action) => {
      if (action.type === 'socket-message') {
        const { socket, msg, cb } = action;
        serializer = serializer.then(() => {
          return controller[msg.type].call(controller, socket, msg, cb);
        }).catch((err) => {
          logger.error('Uncaught error in files: ', { err });
          return Promise.resolve(null);
        });
      } else {
        return state;
      }
    });

    socket.listen((msg, cb) => {
      store.dispatch({ type: 'socket-message', socket, msg, cb });
    });

    store.dispatch({
      type: 'socket-message',
      socket,
      msg: {
        type: 'hello',
      },
      cb: () => {}
    });
  });
};


function getFileInfo(file) {
  var info = {};
  try {
    var stats = fs.statSync(file);
    /* eslint-disable camelcase */
    info.is_file = stats.isFile();
    info.is_directory = stats.isDirectory();
    /* eslint-enable camelcase */
    info.mtime = stats.mtime;
    info.size = stats.size;
  } catch(e){
    logger.debug('getFileInfo: ' + file + ':' + e);
    return null;
  }
  return info;
}

function sendList(socket, filepath, callback, opts) {
  fs.exists(filepath, function(exists) {
    if (!exists) { return fail('Directory no longer exists'); }

    fs.readdir(filepath, function(err, files) {
      if (err) { return fail('Failed to readdir:\n' + err); }

      var result = [];
      for (var i in files) {
        var name = files[i];
        var file = filepath + '/' + name;
        var info = getFileInfo(file);
        if (info) {
          info.name = name;
          result.push(info);
        }
      }
      return success(result);
    });
  });

  function success(result) {
    if (callback) { callback(null, result); }

    if (opts.cd) {
      pathWatcher.watch(
        filepath,
        function listener(filepath) { sendList(socket, filepath, null, opts); },
        (err, path) => pathWatcherCb(socket, err, path)
      );
    }

    var mess = {
      type: 'list',
      path: filepath,
      passback: opts.passback,
      result
    };

    // DON'T LOG THIS!  but need to do the sending optimization
    socket.send(mess, false);
  }

  function fail(err) {
    if (callback) { callback(err); }
    socket.send({
      type: 'list_error',
      path: filepath,
      passback: opts.passback,
      error: err
    });
  }
}

function pathWatcherCb(socket, err, filepath) {
  if (err) {
    logger.debug(err);

    socket.send({
      type: 'hide_files_list_loading'
    });

    return;
  }

  /* eslint-disable camelcase */
  state.watched_path = filepath;
  /* eslint-enable camelcase */
}
