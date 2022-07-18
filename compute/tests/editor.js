/* global describe, it */
require('should');

const path = require('path');
const uuid = require('uuid');

const makeServer = require('../server');
const { checkLog } = require('./util');
const Socket = require('../utils/socket');

let lastPort = 3200;

const DEFAULT_PRESENCE = {
  cursorPosition: {
    anchor: { ch: 0, line: 0 },
    head: { ch: 0, line: 0 }
  }
};

const TEST_FILE = path.join(__dirname, 'fixtures', 'fixture.txt');

describe('editor', () => {
  it('says hello', () => {
    const {server} = makeServer();
    const port = lastPort++;

    const expected = [
      {
        type: 'update',
        files: [],
        users: { 'test-client': { filename: null } },
        presence: {}
      }
    ];

    return checkLog(server, port, 'editor/connect/test-client', [], expected);
  });

  it('opens then closes a file', () => {
    const {server} = makeServer();
    const port = lastPort++;

    const callbackId = uuid.v4();

    const outgoing = [
      {
        type: 'open',
        path: TEST_FILE,
        callbackId
      },
      {
        type: 'close',
        path: TEST_FILE,
        callbackId
      }
    ];

    const expected = [
      { // Initial hello update
        type: 'update',
        files: [],
        users: {
          'test-client': {
            filename: null
          }
        },
        presence: {}
      },
      { // Update after open
        type: 'update',
        files: [{ name: TEST_FILE }],
        users: {
          'test-client': {
            filename: TEST_FILE,
            ...DEFAULT_PRESENCE
          }
        },
        presence: {
          [TEST_FILE]: {
            'test-client': {
              filename: TEST_FILE,
              ...DEFAULT_PRESENCE
            }
          }
        }
      },
      { // Callback after open (should be after update)
        type: Socket.callbackType,
        responseTo: 'open',
        args: [null],
        callbackId
      },
      { // Update after close
        type: 'update',
        files: [],
        users: {
          'test-client': {
            filename: null
          }
        },
        presence: {}
      },
      { // Callback after close (should be after update)
        type: Socket.callbackType,
        responseTo: 'close',
        args: [null],
        callbackId
      },
    ];

    return checkLog(server, port, 'editor/connect/test-client', outgoing, expected);
  });

  it('sets open files', () => {
    const {server} = makeServer();
    const port = lastPort++;

    const callbackId = uuid.v4();

    const outgoing = [
      {
        type: 'set',
        target: [TEST_FILE],
        callbackId
      },
      {
        type: 'set',
        target: [],
        callbackId
      }
    ];

    const expected = [
      { // Initial hello update
        type: 'update',
        files: [],
        users: {
          'test-client': {
            filename: null
          }
        },
        presence: {}
      },
      { // Update after set
        type: 'update',
        files: [{ name: TEST_FILE }],
        users: {
          'test-client': {
            filename: TEST_FILE,
            ...DEFAULT_PRESENCE
          }
        },
        presence: {
          [TEST_FILE]: {
            'test-client': {
              filename: TEST_FILE,
              ...DEFAULT_PRESENCE
            }
          }
        }
      },
      { // Callback after set (should be after update)
        type: Socket.callbackType,
        responseTo: 'set',
        args: [null],
        callbackId
      },
      { // Update after close
        type: 'update',
        files: [],
        users: {
          'test-client': {
            filename: null
          }
        },
        presence: {}
      },
      { // Callback after set (should be after update)
        type: Socket.callbackType,
        responseTo: 'set',
        args: [null],
        callbackId
      }
    ];

    return checkLog(server, port, 'editor/connect/test-client', outgoing, expected);
  });

  it('handles multiple users', () => {
    const {server} = makeServer();
    const port1 = lastPort++;
    const port2 = lastPort++;

    const callbackId = uuid.v4();

    const outgoing = [
      {
        type: 'open',
        path: TEST_FILE,
        callbackId
      },
      {
        type: 'close',
        path: TEST_FILE,
        callbackId
      }
    ];

    const expected = (client) => [
      { // Initial hello update
        type: 'update',
        files: [],
        users: {
          [client]: {
            filename: null
          }
        },
        presence: {}
      },
      { // Update after open
        type: 'update',
        files: [{ name: TEST_FILE }],
        users: {
          [client]: {
            filename: TEST_FILE,
            ...DEFAULT_PRESENCE
          }
        },
        presence: {
          [TEST_FILE]: {
            [client]: {
              filename: TEST_FILE,
              ...DEFAULT_PRESENCE
            }
          }
        }
      },
      { // Callback after open (should be after update)
        type: Socket.callbackType,
        responseTo: 'open',
        args: [null],
        callbackId
      },
      { // Update after close
        type: 'update',
        files: [],
        users: {
          [client]: {
            filename: null
          }
        },
        presence: {}
      },
      { // Callback after close (should be after update)
        type: Socket.callbackType,
        responseTo: 'close',
        args: [null],
        callbackId
      },
    ];

    return checkLog(server, port1, 'editor/connect/test-client', outgoing, expected('test-client'))
      .then(() => checkLog(server, port2, 'editor/connect/test-client2', outgoing, expected('test-client2')));
  });
});
