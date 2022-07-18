const CALLBACK_MESSAGE = 'web-terminal/socket/callback';

const clientsMiddleware = () => {
  const clients = [];

  return (ws, req, next) => {
    req.clients = clients;

    const socket = new Socket(ws, req);
    req.socket = socket;

    socket.onOpen().then(() => {
      clients.push(socket);

      next();
    }).catch(err => next(err));
  };
};

class Socket {
  static get middleware() {
    return clientsMiddleware;
  }

  static get callbackType() {
    return CALLBACK_MESSAGE;
  }

  constructor(ws, req) {
    this.ws = ws;
    this.clients = req.clients;

    // Set up autoclose/cleanup
    this.onClose(() => this._close());

    // Set up close on idle
    this.stopHeartbeat = this.startHeartbeat();
  }

  startHeartbeat() {
    this.isAlive = true;

    const pongListener = () => { this.isAlive = true; };
    this.ws.on('pong', pongListener);

    const intervalId = setInterval(() => {
      if (!this.isAlive) {
        this.close();
      }

      this.isAlive = false;
      this.ws.ping();
    }, 15 * 1000);

    // return unsubscribe
    return () => {
      clearInterval(intervalId);
      this.ws.removeListener('pong', pongListener);
    };
  }

  _sendCbMessage(callbackId, responseTo, args) {
    this.send({
      type: CALLBACK_MESSAGE,
      responseTo,
      callbackId,
      args
    });
  }

  onOpen() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === 1) {
        // OPEN
        return resolve(this);
      } else if (this.ws.readyState === 0) {
        // CONNECTING
        this.ws.once('open', () => resolve(this));
        this.ws.once('error', (err) => reject(err));
      } else {
        // CLOSING or CLOSED
        reject(new Error('Socket already closed.'));
      }
    });
  }

  send(message) {
    this.sendRaw(JSON.stringify(message));
  }

  sendRaw(message) {
    this.clients.forEach(socket => socket.ws.send(message));
  }

  sendRawDirect(message) {
    this.ws.send(message);
  }

  listen(listener) {
    return this.listenRaw((msg) => {
      const message = JSON.parse(msg);
      listener(message, (...args) => {
        // Don't send a message if nobody is listening
        if (message.callbackId) {
          this._sendCbMessage(message.callbackId, message.type, args);
        }
      });
    });
  }

  listenRaw(listener) {
    this.ws.on('message', listener);

    return () => {
      this.ws.removeListener('message', listener);
    };
  }

  close(reason) {
    this.ws.close(reason);
  }

  onClose(listener) {
    this.ws.once('close', listener);
  }

  _close() {
    const index = this.clients.indexOf(this);
    this.clients.splice(index, 1); // Remove ourselves
    this.stopHeartbeat();
    this.ws.removeAllListeners();
  }
}

module.exports = Socket;
