/* eslint-disable camelcase */

const Promise = require('bluebird');
const path = require('path');
const fs = Promise.promisifyAll(require('fs.extra'));
const sha3 = require('sha3');
const normalizeNewline = require('normalize-newline');
const logger = require('../utils/log').child({ module: 'editor' });
const _ = require('lodash');
const redux = require('redux');

const livedb = require('livedb');
const sharejs = require('share');
const Duplex = require('stream').Duplex;

const Socket = require('../utils/socket');

// ok, new architecture:
// server holds state for each editor instance, keyed by filename? internal id?

// each file is a:
// - file name
// - share js document
// - (optionally) snapshot of a disk file (from when the file was opened or last saved)

// when a client first connects, we send a single hello message that updates their state to our state
// clients receive update messages, which contain the new set of files they should have open

// major client operations
// - open a single file
//   - check if file is too large
//     - allow override
// - save a single file
//   - check if the file has been changed since opening (deleted, etc.)
//     - allow override
// - close a single file
//   - allow atomic save
//     - allow override if file was changed on disk
//   - check if the file has unsaved changes
//     - allow override
// - set the set of current open files
//   - option to save closed files
//   - allow overrides on open, save, close
// - emit presence in a file
// - receive presence of other users

// TODO:
//   - have a way to throw multiple errors?
//     this is useful for the case of setOpenFiles, for example

const KnownEditorErrors = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_CHANGED_ON_DISK: 'FILE_CHANGED_ON_DISK',
  UNSAVED_CHANGES: 'UNSAVED_CHANGES',
  INVALID_INPUT: 'INVALID_INPUT',
};

function KnownEditorError(errCode, data) {
  this.code = errCode;
  this.data = data;
}

KnownEditorError.prototype = new Error();

function handleKnownErrors(err, cb) {
  if (err instanceof KnownEditorError) {
    return cb({
      code: err.code,
      data: err.data,
      known: true,
    });
  }
  cb(err);
  throw err;
}

class ShareJSConnector {
  constructor(connector) {
    this.conn = Promise.promisifyAll(connector);
  }

  _shareDoc(op, filename) {
    return this.conn.submitAsync('files', filename, op);
  }

  snapshot(filename) {
    return this.conn.fetchAsync('files', filename);
  };

  open(filename, contents) {
    const op = {
      create: {
        type: 'text',
        data: contents
      }
    };
    return this._shareDoc(op, filename);
  }

  close(filename) {
    const op = {del: true}
    return this._shareDoc(op, filename);
  }
}

function EditorController(conn) {
  // map from client id to object with
  // - username
  this.users = {};
  this.files = {};
  this.share = new ShareJSConnector(conn);
}

function defaultPresence(username, filename) {
  const presence = {
    username: username,
    filename: filename
  };
  if (filename) {
    presence.cursorPosition = {
      head: {
        line: 0,
        ch: 0
      },
      anchor: {
        line: 0,
        ch: 0
      }
    };
  }
  return presence;
}

EditorController.prototype.update = function (socket) {
  const files = _.map(this.files, (file) => { return { name: file.info.name }; });

  let presence = _.reduce(this.files, (presence, file) => {
    presence[file.name] = {};
    return presence;
  }, {});

  if (files.length > 0) {
    presence = _.reduce(this.users, (result, session, clientId) => {
      result[session.filename][clientId] = session;
      return result;
    }, presence);
  }

  const outgoing = {
    type: 'update',
    files: files,
    users: this.users,
    presence: presence
  };

  socket.send(outgoing);
};

EditorController.prototype.hello = function (socket, message, id, cb) {
  // if there are any open files, put the user in the first one
  let filename = null;
  const filenames = Object.keys(this.files);
  if (filenames.length) {
    filename = filenames[0];
  }

  // TODO: use reassignUsers?
  // register the user
  this.users[id] = defaultPresence(message.username, filename);

  this.update(socket);
  cb(null);
};

// reassign users that are on invalid or no file
EditorController.prototype._reassignUsers = function() {
  let newTab = null;
  if (Object.keys(this.files).length) {
    newTab = Object.keys(this.files)[0];
  }

  for (const clientId in this.users) {
    let user = this.users[clientId];
    if (!(user.filename && this.files[user.filename])) {
      this.users[clientId] = defaultPresence(user.username, newTab);
    }
  }
};

EditorController.prototype._tryGetNormalized = function (filepath) {
  try {
    const filename = path.normalize(filepath);
    return filename;
  } catch (e) {
    throw new KnownEditorError(KnownEditorErrors.INVALID_INPUT, {filepath: filepath});
  }
};

EditorController.prototype._open = function (filename, options) {
  options = options || {};

  const stat_options = {};
  if (!options.force) {
    stat_options.maxsize = 1000000;
  }
  return this._info(filename, stat_options).then((info) => {
    return this.share.open(info.name, info.contents).then((doc) => {
      return { doc: doc, presence: {}, name: info.name, info: info };
    });
  }).then((file) => {
    this.files[filename] = file;
  });
};

// Message is of form: {
//   path: file name,
//   // optional
//   forceOpen || force : whether to open even if it's a large file
// }
EditorController.prototype.open = function (socket, message, id, cb) {
  const filename = this._tryGetNormalized(message.path);

  let prom = Promise.resolve();
  if (!this.files[filename]) {
    prom = prom.then(() => {
      return this._open(filename, { force: message.forceOpen || message.force });
    });
  }

  return prom.then(() => {
    // if this is the first file, everyone goes into this file
    this._reassignUsers();
    // user who opened should go to that file
    this.users[id] = defaultPresence(message.username, filename);
    this.update(socket);
    cb(null);
  }).catch((err) => {
    handleKnownErrors(err, cb);
  }).finally(() => {
    // just in case
    this._reassignUsers();
  });
};

EditorController.prototype._close = function (filename, options) {
  options = options || {};
  let prom = Promise.resolve();
  if (options.save) {
    prom = prom.then(() => {
      return this._save(filename, {force: options.forceSave});
    });
  } else if (!options.forceClose) {
    // prom = prom.then(() => {
    //   const onDisk =  this._info(filename);
    //   const shareJs = snapshotShareDoc(filename);
    //   return Promise.join(onDisk, shareJs, (onDiskInfo, shareJsInfo) => {
    //     const originalHash = this.files[filename].info.hash;
    //     const curHash = hash(shareJsInfo.data);
    //     if (curHash !== originalHash) {
    //       throw new KnownEditorError(KnownEditorErrors.UNSAVED_CHANGES, {filename: filename});
    //     }
    //     if (curHash !== onDiskInfo.hash) {
    //       throw new KnownEditorError(KnownEditorErrors.UNSAVED_CHANGES, {filename: filename});
    //     }
    //   });
    // });
    prom = prom.then(() => {
      return this.share.snapshot(filename);
    }).then((result) => {
      const curHash = hash(result.data);
      if (curHash !== this.files[filename].info.hash) {
        throw new KnownEditorError(KnownEditorErrors.UNSAVED_CHANGES, {filename: filename});
      }
    });
  }

  return prom.then(() => {
    return this.share.close(filename);
  }).then(() => {
    // delete the file from the list of files
    delete this.files[filename];
  });
};

// Message is of form: {
//   path: file name,
//   // optional
//   save: whether to save before closing,
//   forceSave: whether to save even if file on disk was changed,
//   forceClose || force: whether to close even with unsaved changes,
// }
EditorController.prototype.close = function (socket, message, id, cb) {
  const filename = this._tryGetNormalized(message.path);

  if (!this.files[filename]) {
    // The file is already closed.
    this.update(socket);
    cb(null);
    return Promise.resolve();
  }

  return this._close(filename, {
    save: message.save || message.saveClosed,
    forceSave: message.forceSave,
    forceClose: message.forceClose || message.force,
  }).then(() => {
    // move clients that used to be on that tab
    this._reassignUsers();

    this.update(socket);
    cb(null);
  }).catch((err) => {
    handleKnownErrors(err, cb);
  }).finally(() => {
    // just in case
    this._reassignUsers();
  });
};

/*
 * Returns the following info for a file:
 * - name: name of file
 * - stats: result of fs.statAsync, null if no file exists
 * - contents: contents of file, null if no file exists
 * - hash: hash of contents of file
 */
EditorController.prototype._info = function(filename, options = {}) {
  return fs.statAsync(filename).catchReturn({ code: 'ENOENT' }, null).then(function (stats) {
    if (options.maxsize) {
      if (stats) {
        if (stats.size > options.maxsize) {
          throw new KnownEditorError(KnownEditorErrors.FILE_TOO_LARGE, {filename: filename});
        }
      }
    }

    const info =  {
      stats: stats,
      name: filename
    };

    if (!stats) {
      info.contents = null;
      return info;
    }

    return fs.readFileAsync(filename).then((contents) => {
      info.contents = normalizeNewline(contents.toString('utf8'));
      return info;
    });
  }).then((info) => {
    info.hash = hash(info.contents);
    return info;
  });
};

EditorController.prototype._save = function(filename, options) {
  options = options || {};

  const file = this.files[filename];

  const newData = this.share.snapshot(file.name).then((result) => {
    const contents = result.data;
    return { contents: contents, hash: hash(contents), name: file.name };
  });

  const currentFile = this._info(file.name);

  return Promise.join(newData, currentFile, (proposed, current) => {
    // File was changed on disk since opening
    if (!options.force) {
      if (current.hash !== file.info.hash) {
        // TODO: minor, but should give client information about whether they were trying to
        // atomically close
        throw new KnownEditorError(KnownEditorErrors.FILE_CHANGED_ON_DISK, {filename: file.name});
      }
    }

    // Check if file was actually changed at all, if not don't bother saving it
    if (current.hash === proposed.hash) {
      return Promise.resolve();
    }

    const directory = file.name.split('/').slice(0, -1).join('/');
    return fs.mkdirpAsync(directory).then(() => {
      return fs.writeFileAsync(file.name, proposed.contents);
    }).then(function () {
      // update contents
      // NOTE: should update stats too?
      file.info.contents = proposed.contents;
      file.info.hash = proposed.hash;
    });
  });
};


// Message is of form: {
//   path: file name,
//   // optional
//   forceSave || force: whether to save even if file on disk was changed,
// }
EditorController.prototype.save = function (socket, message, id, cb) {
  const filename = this._tryGetNormalized(message.path);

  if (!this.files[filename]) {
    cb(null);
    return Promise.resolve();
  }

  return this._save(filename, {force: message.force || message.forceSave})
    .then(() => cb(null))
    .catch((err) => {
      handleKnownErrors(err, cb);
    });
};

// Sets the current set of open files.
// Message is of form: {
//   target: list of file names,
//   // optional
//   save: whether to save before closing,
//   forceSave: whether to save even if file on disk was changed,
//   forceClose: whether to close even with unsaved changes,
//   forceOpen: whether to open even if it's a large file
// }
EditorController.prototype.set = function (socket, message, id, cb) {
  const target = message.target.map((filepath) => {
    return this._tryGetNormalized(filepath);
  });

  const current = Object.keys(this.files);

  // Files to close/open
  const toClose = _.difference(current, target);
  const toOpen = _.difference(target, current);

  const close = Promise.all(toClose.map((filename) => {
    return this._close(filename, {
      save: message.save || message.saveClosed,
      forceSave: message.forceSave,
      forceClose: message.forceClose,
    });
  }));

  const open = Promise.all(toOpen.map((filename) => {
    return this._open(filename, {
      force: message.forceOpen
    });
  }));

  return Promise.join(close, open).then(() => {
    this._reassignUsers();
    this.update(socket);
    cb(null);
  }).catch((err) => {
    // inform that it was a close?
    handleKnownErrors(err, cb);
  }).finally(() => {
    // just in case
    this._reassignUsers();
  });
};

// Message must contain: { path: file name, presence: presence information }
EditorController.prototype.presence = function (socket, message, id) {
  const filename = this._tryGetNormalized(message.path);

  // Stale presence notification to a closed file, ignore.
  if (!this.files[filename]) {
    return;
  }

  const old_presence = this.users[id];
  if (!old_presence) {
    // TODO: tell client they should say hello first!
    return;
  }

  // Clear existing presence for this user.
  let presence;
  if (!message.presence) {
    presence = defaultPresence(old_presence.username, filename);
  } else {
    presence = _.cloneDeep(message.presence);
    presence.username = old_presence.username;
    presence.filename = filename;
  }
  this.users[id] = presence;

  this.update(socket);
};

EditorController.prototype.disconnect = function (socket, message, id) {
  delete this.users[id];
  this.update(socket);
};

// Take the SHA3 hash of the given string
function hash(contents) {
  contents = contents || '';
  var hasher = new sha3.SHA3Hash();
  hasher.update(contents);
  return hasher.digest('hex');
}

module.exports = function (app) {
  const backend = livedb.client(livedb.memory());
  const share = sharejs.server.createClient({ backend: backend });
  const controller = new EditorController(backend);

  // Promise used to serialize all actions.
  let serializer = Promise.resolve();

  const store = redux.createStore((state = {}, action) => {
    if (action.type === 'socket-message') {
      const { socket, msg, cb, id } = action;
      serializer = serializer.then(() => {
        return controller[msg.type].call(controller, socket, msg, id, cb);
      }).catch((err) => {
        logger.error('Uncaught error in editor: ', { err });
        return Promise.resolve(null);
      });
    }

    return state;
  });

  //======================================================
  // Websocket for Editor
  // handles events such as save, update, close
  //======================================================
  app.ws('/editor/connect/:id', Socket.middleware(), (ws, req) => {
    const socket = req.socket;
    const id = req.params.id;

    socket.listen((msg, cb) => {
      store.dispatch({ socket, id, msg, cb, type: 'socket-message' });
    });

    socket.onClose(() => {
      store.dispatch({
        socket,
        type: 'socket-message',
        cb: () => {},
        id,
        msg: {
          type: 'disconnect'
        }
      });
    });

    // Simulate hello message
    store.dispatch({
      socket,
      type: 'socket-message',
      cb: () => {},
      id,
      msg: {
        type: 'hello'
      }
    });
  });

  //======================================================
  // Websocket for ShareJS
  // updates the shared doc after each keystroke
  //======================================================
  app.ws('/editor/sharejs/:id', Socket.middleware(), (client, req) => {
    // client is channel to browser
    // stream is channel to sharejs server
    const stream = new Duplex({ objectMode: true });

    stream._write = (chunk, encoding, callback) => {
      client.send(JSON.stringify(chunk));
      callback();
    };

    stream._read = () => { };

    stream.headers = client.headers;
    stream.remoteAddress = stream.address;

    client.on('message', (data) => {
      stream.push(JSON.parse(data));
    });

    stream.on('error', (msg) => {
      // sharejs emitted an error
      // client needs to close and reopen the connection.
      client.close(msg);
    });

    client.on('close', function (reason) {
      stream.push(null); //
      stream.emit('close');
      client.close(reason);
    });

    stream.on('end', () => {
      client.close()
    })

    return share.listen(stream);
  });
};
