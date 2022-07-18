const rp = require('request-promise');

module.exports = function (app) {
  app.get('/ports/:port/:path(*)', async (req, res) => {
    const {port, path} = req.params;

    try {
      const response = await rp({
        uri: `http://localhost:${port}/${path}`,
        resolveWithFullResponse: true,
        simple: false,
        timeout: 500
      });

      res.send(response.statusCode, response.body);
    } catch (e) {
      res.send(500);
    }
  });
};
