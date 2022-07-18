/* global describe, it */

const uuid = require('uuid');

let lastPort = 3400;

const Promise = require('bluebird');
const WebSocket = require('ws');
const makeServer = require('../server');
const { listen, takeSocket, logSocket } = require('./util');
const Socket = require('../utils/socket');

const route = 'terminal/control';

describe('terminal', () => {
  it('says hello', async () => {
    const {server} = makeServer();
    const port = lastPort++;

    const ws = await listen(server, port, route);

    try {
      const [hello] = await takeSocket(ws);
      hello.should.deepEqual({
        type: 'list',
        data: []
      });
    } finally {
      ws.close();
      server.close();
    }
  });

  it('can create and destroy a terminal', async () => {
    const {server} = makeServer();
    const port = lastPort++;
    const callbackId = uuid.v4();

    const cwd = '/home';
    const mode = 'RW';

    const ws = await listen(server, port, route);

    try {
      const [hello] = await takeSocket(ws);
      hello.should.deepEqual({
        type: 'list',
        data: []
      });

      ws.send(JSON.stringify({
        type: 'create',
        cwd,
        cols: 81,
        rows: 25,
        callbackId
      }));

      let [resp, callback] = await logSocket(ws, 2, { close: false });
      const pid = resp.data[0].pid;
      const id = resp.data[0].id;
      const title = resp.data[0].title;

      resp.should.deepEqual({
        type: 'list',
        data: [{
          id,
          title,
          mode,
          pid,
          cols: 81,
          rows: 25
        }]
      });

      callback.should.deepEqual({
        type: Socket.callbackType,
        responseTo: 'create',
        args: [
          null,
          {
            id,
            title,
            mode,
            pid,
            cols: 81,
            rows: 25
          }
        ],
        callbackId
      });

      ws.send(JSON.stringify({
        type: 'size',
        callbackId,
        id,
        cols: 10,
        rows: 12
      }));

      [resp, callback] = await logSocket(ws, 2, { close: false });

      resp.should.deepEqual({
        type: 'list',
        data: [{
          id,
          title,
          mode,
          pid,
          cols: 10,
          rows: 12
        }]
      });

      callback.should.deepEqual({
        type: Socket.callbackType,
        responseTo: 'size',
        callbackId,
        args: [
          null,
          {
            id,
            cols: 10,
            rows: 12
          }
        ]
      });

      ws.send(JSON.stringify({
        type: 'destroy',
        callbackId,
        id
      }));

      [resp, callback] = await logSocket(ws, 2, { close: false });

      resp.should.deepEqual({
        type: 'list',
        data: []
      });

      callback.should.deepEqual({
        type: Socket.callbackType,
        responseTo: 'destroy',
        args: [
          null,
          {
            id
          }
        ],
        callbackId
      });

      ws.send(JSON.stringify({
        type: 'list',
        callbackId
      }));

      [resp, callback] = await logSocket(ws, 2, { close: false });

      resp.should.deepEqual({
        type: 'list',
        data: []
      });

      callback.should.deepEqual({
        type: Socket.callbackType,
        responseTo: 'list',
        args: [
          null,
          []
        ],
        callbackId
      });
    } finally {
      ws.close();
      server.close();
    }
  });

  it('can pipe I/O to a terminal', async () => {
    const {server} = makeServer();
    const port = lastPort++;
    const callbackId = uuid.v4();

    let directWs = null;
    const mode = 'RW';
    const cwd = '/home';

    const ws = await listen(server, port, route);

    try {
      const [hello] = await takeSocket(ws);
      hello.should.deepEqual({
        type: 'list',
        data: []
      });

      ws.send(JSON.stringify({
        type: 'create',
        cwd,
        cols: 100,
        rows: 12,
        callbackId,
        env: {
          MESSAGE: 'hello world',
          PS1: '$ ' // set bash prompt
        },
        command: 'sh'
      }));

      let [resp, callback] = await logSocket(ws, 2, { close: false });

      // Generated on the server
      const pid = resp.data[0].pid;
      const id = resp.data[0].id;
      const title = resp.data[0].title;

      resp.should.deepEqual({
        type: 'list',
        data: [{
          id,
          title,
          mode,
          pid,
          cols: 100,
          rows: 12
        }]
      });

      callback.should.deepEqual({
        type: Socket.callbackType,
        responseTo: 'create',
        args: [
          null,
          {
            id,
            title,
            mode,
            pid,
            cols: 100,
            rows: 12
          }
        ],
        callbackId
      });

      directWs = new WebSocket(`ws://127.0.0.1:${port}/terminal/connect/${id}`);

      const prompt = '$ ';
      const logPromise = logSocket(directWs, 1, { close: false, parse: false });
      // Must await open after calling logSocket (not before), to avoid a race.
      //  We have to set up the listener immediately so we don't miss the initial messages.
      await new Promise(resolve => directWs.on('open', resolve));
      const initialLog = await logPromise;
      initialLog.should.deepEqual([
        '$ '
      ]);

      directWs.send('echo $MESSAGE\n');

      const expected = [
        'echo $MESSAGE\r\n',
        'hello world\r\n',
        '$ '
      ].reduce((x, y) => x.concat(y));

      await buildLog(directWs, expected);

      // Open another socket and check we get the whole log
      directWs.close();
      directWs = new WebSocket(`ws://127.0.0.1:${port}/terminal/connect/${id}`);
      await buildLog(directWs, prompt.concat(expected));
    } finally {
      server.close();
      if (directWs) { directWs.close(); }
      ws.close();
    }
  });

  it('can set terminals', async () => {

    const {server} = makeServer();
    const port = lastPort++;
    const callbackId = uuid.v4();

    const ws = await listen(server, port, route);

    try {
      const [hello] = await takeSocket(ws);
      hello.should.deepEqual({
        type: 'list',
        data: []
      });

      ws.send(JSON.stringify({
        type: 'set',
        callbackId,
        terminals: [
          { id: 'first' },
          { id: 'second' }
        ]
      }));

      let [resp, callback] = await logSocket(ws, 2, { close: false });

      resp.should.deepEqual({
        type: 'list',
        data: [
          {
            id: 'first',
            title: resp.data[0].title,
            pid: resp.data[0].pid,
            mode: 'RW',
            cols: 80,
            rows: 24
          },
          {
            id: 'second',
            title: resp.data[1].title,
            pid: resp.data[1].pid,
            mode: 'RW',
            cols: 80,
            rows: 24
          }
        ]
      });

      callback.should.deepEqual({
        type: Socket.callbackType,
        callbackId,
        responseTo: 'set',
        args: [
          null,
          [
            {
              id: 'first',
              title: resp.data[0].title,
              pid: resp.data[0].pid,
              mode: 'RW',
              cols: 80,
              rows: 24
            },
            {
              id: 'second',
              title: resp.data[1].title,
              pid: resp.data[1].pid,
              mode: 'RW',
              cols: 80,
              rows: 24
            }
          ]
        ]
      });

      // Delete just one
      ws.send(JSON.stringify({
        type: 'set',
        callbackId,
        terminals: [
          { id: 'second' }
        ]
      }));

      [resp, callback] = await logSocket(ws, 2, { close: false });

      resp.should.deepEqual({
        type: 'list',
        data: [
          {
            id: 'second',
            title: resp.data[0].title,
            pid: resp.data[0].pid,
            mode: 'RW',
            cols: 80,
            rows: 24
          }
        ]
      });

      callback.should.deepEqual({
        type: Socket.callbackType,
        callbackId,
        responseTo: 'set',
        args: [
          null,
          [
            {
              id: 'second',
              title: resp.data[0].title,
              pid: resp.data[0].pid,
              mode: 'RW',
              cols: 80,
              rows: 24
            }
          ]
        ]
      });

      // Clear
      ws.send(JSON.stringify({
        type: 'set',
        callbackId,
        terminals: []
      }));

      [resp, callback] = await logSocket(ws, 2, { close: false });

      resp.should.deepEqual({
        type: 'list',
        data: []
      });

      callback.should.deepEqual({
        type: Socket.callbackType,
        callbackId,
        responseTo: 'set',
        args: [null, []]
      });
    } finally {
      ws.close();
      server.close();
    }
  });
});

function buildLog(ws, expected, { maxMessages = 10, delay = 500 } = {}) {
  let interval = null;
  let listener = null;

  return new Promise((resolve, reject) => {
    let log = '';
    let messages = 0;
    let last = Date.now();

    listener = (message) => {
      if (messages === 0) {
        interval = setInterval(() => {
          const now = Date.now();
          if (now - delay > last) {
            reject(new Error('too long without a message'));
          }
        }, delay);
      }

      messages += 1;
      last = Date.now();
      log = log.concat(message);

      if (log === expected) {
        resolve();
      } else if (messages >= maxMessages) {
        reject(new Error('too many messages'));
      }
    };

    ws.on('message', listener);
  }).finally(() => {
    if (listener) {
      ws.removeListener('message', listener);
    }

    if (interval) {
      clearInterval(interval);
    }
  });
}
