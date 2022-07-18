/* global describe, it */
require('should');

const express = require('express');
const expressWs = require('express-ws');
const uuid = require('uuid');
const http = require('http');
const WebSocket = require('ws');
const Promise = require('bluebird');

const { logSocket } = require('./util');

const Socket = require('../utils/socket');

const makeServer = () => {
  const app  = express();
  const server = http.createServer(app);
  expressWs(app, server);

  app.ws('/echo', Socket.middleware(), (ws, req) => {
    const socket = req.socket;

    socket.listen((msg, cb) => {
      socket.send(msg);
      cb(msg);
    });
  });

  app.ws('/echo2', Socket.middleware(), (ws, req) => {
    const socket = req.socket;

    socket.listen((msg, cb) => {
      socket.send(msg);
      cb(msg);
    });
  });

  return server;
};

let lastPort = 3099;

describe('socket layer', () => {
  it('echos back json messages', (done) => {
    const server = makeServer();
    const port = lastPort++;

    server.listen(port, () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/echo`);

      const callbackId = uuid.v4();
      const message = { now: Date.now(), callbackId };

      ws.on('open', () => {
        ws.send(JSON.stringify(message));
      });

      logSocket(ws, 2).then(messages => {
        messages.should.deepEqual([
          message,
          { type: Socket.callbackType, callbackId, args: [message] }
        ]);

        done();
      }).catch(err => done(err)).finally(() => server.close());
    });
  });

  it('echos messages to all clients in its group', (done) => {
    const NUM_CLIENTS = 5;

    const server = makeServer();
    const port = lastPort++;
    const clients = [];

    const callbackId = uuid.v4();
    const message = { now: Date.now(), callbackId };
    const callback = { type: Socket.callbackType, callbackId, args: [message] };

    server.listen(port, () => {
      for (let i = 0; i < NUM_CLIENTS; i++) {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/echo`);
        const messages = [];

        const complete = logSocket(ws, 2 * NUM_CLIENTS);

        ws.on('open', () => {
          ws.send(JSON.stringify(message));
        });

        clients.push({ messages, ws, complete });
      }

      Promise.all(clients.map(({complete}) => complete)).then((allMessages) => {
        const expected = [];
        for (let i = 0; i < NUM_CLIENTS; i++) {
          expected.push(message);
          expected.push(callback);
        }

        allMessages.forEach((messages) => {
          messages.should.deepEqual(expected);
        });

        done();
      }).catch(err => done(err)).finally(() => server.close());
    });
  });

  it("doesn't echo messages to clients not in its group", (done) => {
    const NUM_CLIENTS = 5;

    const server = makeServer();
    const port = lastPort++;
    const echoClients = [];
    const echo2Clients = [];

    const callbackId = uuid.v4();
    const message = { now: Date.now(), callbackId };
    const callback = { type: Socket.callbackType, callbackId, args: [message] };

    const message2 = { now: Date.now() + 200, callbackId };
    const callback2 = { type: Socket.callbackType, callbackId, args: [message2] };

    server.listen(port, () => {
      for (let i = 0; i < NUM_CLIENTS; i++) {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/echo`);

        echoClients.push(logSocket(ws, 2 * NUM_CLIENTS));

        ws.on('open', () => {
          ws.send(JSON.stringify(message));
        });

        const ws2 = new WebSocket(`ws://127.0.0.1:${port}/echo2`);

        echo2Clients.push(logSocket(ws2, 2 * NUM_CLIENTS));

        ws2.on('open', () => {
          ws2.send(JSON.stringify(message2));
        });
      }

      Promise.join(Promise.all(echoClients), Promise.all(echo2Clients), (echoMessages, echo2Messages) => {
        const expectedEchoMessages = [];
        for (let i = 0; i < NUM_CLIENTS; i++) {
          expectedEchoMessages.push(message);
          expectedEchoMessages.push(callback);
        }

        echoMessages.forEach((messages) => {
          messages.should.deepEqual(expectedEchoMessages);
        });

        const expectedEcho2Messages = [];
        for (let i = 0; i < NUM_CLIENTS; i++) {
          expectedEcho2Messages.push(message2);
          expectedEcho2Messages.push(callback2);
        }

        echo2Messages.forEach((messages) => {
          messages.should.deepEqual(expectedEcho2Messages);
        });
      }).asCallback(done).finally(() => server.close());
    });
  });
});
