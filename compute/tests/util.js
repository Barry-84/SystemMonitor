const WebSocket = require('ws');
const Promise = require('bluebird');

function onClose(ws) {
  return new Promise(resolve => {
    const intervalId = setInterval(() => {
      if (ws.readyState === 3) {
        clearInterval(intervalId);
        resolve();
      }
    }, 10);
  });
}

function logSocket(ws, length, { close = true, parse = true } = {}) {
  if (length === 0) {
    return Promise.resolve([]);
  }

  return new Promise(resolve => {
    const messages = [];
    const listener = (data) => {
      if (parse) {
        messages.push(JSON.parse(data));
      } else {
        messages.push(data);
      }

      if (messages.length === length) {
        if (close) {
          ws.close();

          onClose(ws)
            .then(() => resolve(messages));
        } else {
          // Stop registering messages to this list.
          ws.removeListener('message', listener);
          resolve(messages);
        }
      }
    };

    ws.on('message', listener);
  });
}

function listen(server, port, route) {
  return new Promise(resolve => {
    server.listen(port, () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/${route}`);
      resolve(ws);
    });
  });
}


function checkLog(server, port, route, outgoing, expected,
                  { cleanIncoming = (x) => x } = {}) {
  return listen(server, port, route)
    .tap(ws => {
      ws.once('open',
              () => outgoing.forEach(
                message => ws.send(JSON.stringify(message))));
    }).then(ws => logSocket(ws, expected.length))
    .then(incoming => incoming.map(cleanIncoming).should.deepEqual(expected))
      .finally(() => server.close());
}

function takeSocket(ws, opts = {}) {
  return logSocket(ws, 1, { close: false, ...opts });
}

module.exports = {
  logSocket,
  takeSocket,
  listen,
  checkLog
};
