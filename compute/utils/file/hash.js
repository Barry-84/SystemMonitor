var fs = require('fs');
var sha3 = require('sha3');
// TODO: Use MD5

module.exports = function(path, cb) {
  var hash = new sha3.SHA3Hash();
  var digest;

  // Read the file contents
  try {
    var contents = fs.readFileSync(path);
    hash.update(contents);
  } catch (err) {
    cb(err);
    return;
  }

  // Return a digest of the file contents
  digest = hash.digest('hex');
  cb(null, digest);
};

