var normalizeUUID = require('../lib/util.js').normalizeUUID;
var fs = require('fs');

var accessories = JSON.parse(fs.readFileSync(process.argv[2]).toString());

// console.log(JSON.stringify(accessories, null, 2));

console.log(JSON.stringify(normalizeUUID(accessories), null, 2));
