const pty = require('node-pty');
const logger = require('../utils/log').child({ module: 'terminal' });
const redux = require('redux');
const _ = require('lodash');
const uuid = require('uuid');

const Socket = require('../utils/socket');

const NO_SUCH_TERMINAL = 404;

class TerminalController {
  constructor() {
    this.terminals = {};
    this.titleCounter = 1;
  }

  connectDirect(tid, socket) {
    const terminal = this.terminals[tid];

    if (terminal) {
      logger.info('Connected to terminal', { id: terminal.id });
      for (let log of terminal.log) {
        socket.sendRawDirect(log);
      }

      const dataListener = (data) => {
        socket.sendRawDirect(data);
      };

      terminal.term.on('data', dataListener);

      const stop = socket.listenRaw((msg) => {
        try {
          terminal.term.write(msg);
        } catch (ex) {
          logger.error('Terminal write exception', { ex });
        }
      });

      socket.onClose(() => {
        // Do nothing special, full destroy/cleanup is in the destroy call above
        logger.info('Terminal socket disconnect from', { id: terminal.id });
        stop();
        terminal.term.removeListener('data', dataListener);
      });
    } else {
      socket.close(JSON.stringify({ code: NO_SUCH_TERMINAL }));
    }
  }

  list(socket, msg, cb) {
    const terms = Object.keys(this.terminals).map((terminalId) => {
      const terminal = this.terminals[terminalId];

      return {
        id: terminal.id,
        pid: terminal.pid,
        title: terminal.title,
        mode: terminal.mode,
        cols: terminal.cols,
        rows: terminal.rows
      };
    });

    socket.send({
      type: 'list',
      data: terms
    });

    cb(null, terms);
  }

  _create(msg) {
    const rows = msg.rows || 24;
    const cols = msg.cols || 80;

    const term = pty.spawn(msg.command || 'bash', msg.args || [], {
      name: 'xterm-color',
      cols, rows,
      cwd: msg.cwd || '/home',
      env: { ...process.env, ...(msg.env || {}) }
    });

    logger.info('Created terminal with PID: ' + term.pid);
    const terminal = {
      id: msg.id || uuid.v4(),
      pid: term.pid,
      title: msg.title || `Terminal ${this.titleCounter++}`,
      // one of:
      // RW (read-write)
      // RO (read-only)
      // ST (student writeable only)
      // IN (instructor writeable only)
      mode: msg.mode || 'RW',
      term,
      cols, rows,
      log: []
    };

    terminal.term.on('data', function(data) {
      terminal.log.push(data);
    });

    this.terminals[terminal.id] = terminal;

    return terminal;
  }

  create(socket, msg, cb) {
    const terminal = this._create(msg);

    const terminalRecord = {
      id: terminal.id,
      pid: terminal.pid,
      title: terminal.title,
      mode: terminal.mode,
      cols: terminal.cols,
      rows: terminal.rows
    };

    this.list(socket, {}, () => cb(null, terminalRecord));
  }

  _destroy(id) {
    const terminal = this.terminals[id];
    if (terminal) {
      logger.info('Destroying terminal', { id: terminal.id });

      // Clean things up
      terminal.term.kill();
      delete this.terminals[terminal.id];
    } else {
      return { code: NO_SUCH_TERMINAL };
    }
  }

  destroy(socket, msg, cb) {
    const err = this._destroy(msg.id);
    if (err) {
      cb(err);
    } else {
      this.list(socket, {}, () => cb(null, { id: msg.id }));
    }
  }

  rename(socket, msg, cb) {
    const terminal = this.terminals[msg.id];

    if (terminal) {
      terminal.title = msg.title;

      socket.send({
        type: 'rename',
        data: {
          id: terminal.id,
          title: terminal.title
        }
      });

      cb(null, { id: terminal.id, title: terminal.title });
    } else {
      cb({ code: NO_SUCH_TERMINAL });
    }
  }

  size(socket, msg, cb) {
    const terminal = this.terminals[msg.id];

    if (terminal) {
      terminal.term.resize(msg.cols, msg.rows);

      terminal.rows = msg.rows;
      terminal.cols = msg.cols;

      this.list(socket, {},
                () => cb(null, {
                  id: terminal.id,
                  rows: terminal.rows,
                  cols: terminal.cols
                }));
    } else {
      cb({ code: NO_SUCH_TERMINAL });
    }
  }

  set(socket, { terminals = [] }, cb) {
    const open = Object.keys(this.terminals);
    const target = terminals.map(terminal => terminal.id);

    const requestedTerminals = {};
    terminals.forEach(terminal => requestedTerminals[terminal.id] = terminal);

    const toClose = _.difference(open, target);
    const toOpen = _.difference(target, open);

    toClose.forEach((id) => this._destroy(id));

    toOpen.forEach((id) => {
      this._create(requestedTerminals[id]);
    });

    this.list(socket, {}, cb);
  }
}

module.exports = function (app) {
  const controller = new TerminalController();

  // Promise used to serialize all actions.
  let serializer = Promise.resolve();

  const store = redux.createStore((state = {}, action) => {
    if (action.type === 'socket-message') {
      const { socket, msg, cb } = action;
      serializer = serializer.then(() => {
        return controller[msg.type].call(controller, socket, msg, cb);
      }).catch((err) => {
        logger.error('Uncaught error in terminal: ', { err });
        return Promise.resolve(null);
      });
    }

    return state;
  });

  app.ws('/terminal/connect/:id', Socket.middleware(), function (ws, req) {
    controller.connectDirect(req.params.id, req.socket);
  });

  app.ws('/terminal/control', Socket.middleware(), function(ws, req) {
    const socket = req.socket;

    socket.listen((msg, cb) => {
      store.dispatch({ socket, msg, cb, type: 'socket-message' });
    });

    // Simulate initial list message
    store.dispatch({
      type: 'socket-message',
      socket,
      cb: () => {},
      msg: {
        type: 'list'
      }
    });
  });
};
