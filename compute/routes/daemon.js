const bodyparser = require('body-parser');
const child = require('child_process');

module.exports = function (app) {
  const daemons = {};

  app.get('/daemons', (req, res) => {
    res.set({
      'Access-Control-Allow-Origin': req.headers.origin,
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Method': 'GET',
      'Content-Type': 'application/json'
    });

    res.send(200, JSON.stringify(Object.keys(daemons)));
  });

  app.delete('/daemon/:daemonid', (req, res) => {
    const {daemonid: id} = req.params;

    if (daemons[id]) {
      const process = daemons[id];
      process.kill();
    }

    res.send(200);
  });

  app.post('/daemon/:daemonid', bodyparser.json(), (req, res) => {
    const {daemonid: id} = req.params;
    const {cmd, args, cwd, env, argv0, kill} = req.body;

    res.set({
      'Access-Control-Allow-Origin': req.headers.origin,
      'Access-Control-Allow-Headers': req.header('Access-Control-Request-Headers'),
      'Access-Control-Allow-Method': 'POST',
      'Access-Control-Allow-Credentials': true
    });

    // Daemon already running.
    if (daemons[id] && !kill) {
      // No kill flag, do nothing.
      res.send(200);
    } else {
      // Kill flag, kill running process.
      if (daemons[id] && kill) {
        const process = daemons[id];
        process.kill();
      }

      // Daemon not running yet. Start it.
      const process = child.spawn(cmd, args, {
        cwd: cwd || '/home/workspace',
        env,
        argv0
      });

      daemons[id] = process;

      process.on('close', () => {
        // Don't delete from daemons if we were killed.
        if (daemons[id] === process) {
          delete daemons[id];
        }
      });

      res.send(200);
    }
  });
};
