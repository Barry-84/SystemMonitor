/* global describe, it */
require('should');

const Promise = require('bluebird');
const path = require('path');
const uuid = require('uuid');
const fs = Promise.promisifyAll(require('fs.extra'));
const del = require('del');

const Socket = require('../utils/socket');
const makeServer = require('../server');
const { listen, logSocket, checkLog, takeSocket } = require('./util');

const route = 'finder/connect';

let lastPort = 3300;

const homeEntries = fs.readdirSync('/home').map(file => computeEntry(`/home/${file}`));

function computeEntry(target) {
  const stats = fs.statSync(target);
  const mtime = JSON.parse(JSON.stringify(stats.mtime));

  return {
    name: path.basename(target),
    mtime,
    size: stats.size,
    is_file: stats.isFile(),
    is_directory: stats.isDirectory()
  };
}

describe('files', () => {
  const TEST_PATH = path.resolve('./tests/fixtures');

  const fixtureEntry = computeEntry(`${TEST_PATH}/fixture.txt`);
  const fixtureDirEntry = computeEntry(`${TEST_PATH}/subdir`);
  const fixtureSubEntry = computeEntry(`${TEST_PATH}/subdir/fixture2.txt`);

  it('says hello', () => {
    const {server} = makeServer();
    const port = lastPort++;

    const expected = [{
      type: 'list',
      path: '/home',
      result: homeEntries
    }];

    return checkLog(server, port, route, [], expected);
  });

  it('can list a directory', () => {
    const {server} = makeServer();
    const port = lastPort++;

    const callbackId = uuid.v4();

    const outgoing = [
      {
        type: 'list',
        path: TEST_PATH,
        passback: 'test',
        callbackId
      }
    ];

    const expected = [
      {
        type: 'list',
        path: '/home',
        result: homeEntries
      },
      {
        type: Socket.callbackType,
        callbackId,
        responseTo: 'list',
        args: [
          null,
          [
            fixtureEntry,
            fixtureDirEntry
          ]
        ]
      },
      {
        type: 'list',
        path: TEST_PATH,
        passback: 'test',
        result: [
          fixtureEntry,
          fixtureDirEntry
        ]
      }
    ];

    return checkLog(server, port, route, outgoing, expected);
  });

  it('can listen for changes', async () => {
    // use type 'cd', make a change, see it update
    const {server} = makeServer();
    const port = lastPort++;

    const callbackId = uuid.v4();

    const subdirPath = `${TEST_PATH}/subdir`;
    const newFile = `${subdirPath}/new-file`;

    const ws = await listen(server, port, route);

    try {
      const [hello] = await takeSocket(ws);

      hello.should.deepEqual({
        type: 'list',
        path: '/home',
        result: homeEntries
      });

      // cd to fixtures/subdir
      ws.send(JSON.stringify({
        type: 'cd',
        path: subdirPath,
        passback: 'main',
        callbackId
      }));

      let messages = await logSocket(ws, 2, { close: false });

      messages.should.deepEqual([
        {
          type: Socket.callbackType,
          callbackId,
          responseTo: 'cd',
          args: [
            null,
            [
              fixtureSubEntry,
            ]
          ]
        },
        {
          type: 'list',
          passback: 'main',
          path: subdirPath,
          result: [
            fixtureSubEntry
          ]
        }
      ]);

      // Set up listener for list message after update
      const wait = takeSocket(ws);

      // Add a file to subdir
      await fs.writeFileAsync(newFile, 'some contents');

      // Get the new list message
      const [update] = await wait;
      update.should.deepEqual({
        type: 'list',
        path: subdirPath,
        passback: 'main',
        result: [
          fixtureSubEntry,
          computeEntry(newFile)
        ]
      });

      // Same dance but expect to pick up file deletion
      const wait2 = takeSocket(ws);

      await del(newFile);
      const [update2] = await wait2;
      update2.should.deepEqual({
        type: 'list',
        path: subdirPath,
        passback: 'main',
        result: [
          fixtureSubEntry
        ]
      });

      // Go to another directory with 'list', should not affect watch location
      ws.send(JSON.stringify({
        type: 'list',
        path: TEST_PATH,
        passback: 'modal',
        callbackId
      }));

      messages = await logSocket(ws, 2, { close: false });

      messages.should.deepEqual([
        {
          type: Socket.callbackType,
          callbackId,
          responseTo: 'list',
          args: [
            null,
            [
              fixtureEntry,
              computeEntry(subdirPath) // mtime has changed
            ]
          ]
        },
        {
          type: 'list',
          path: TEST_PATH,
          passback: 'modal',
          result: [
            fixtureEntry,
            computeEntry(subdirPath) // mtime has changed
          ]
        }
      ]);

      const wait3 = takeSocket(ws);

      // Make another change in subdir, expect an update.
      await fs.writeFileAsync(newFile, 'more contents');

      const [update3] = await wait3;
      update3.should.deepEqual({
        type: 'list',
        path: subdirPath,
        passback: 'main',
        result: [
          fixtureSubEntry,
          computeEntry(newFile)
        ]
      });

      ws.close();
    } finally {
      del(newFile);
      ws.close();
      server.close();
    }
  });
});
