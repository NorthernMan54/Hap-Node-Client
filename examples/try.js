var bonjour = require('../node_modules/bonjour-hap')();
var debug = require('../node_modules/debug')("try");


/*
resolver.resolvePtr("_hap._tcp.local").then(function(host) {
  console.log(host);
});

resolver.resolve4("walter.local").then(function(host) {
  console.log(host);
});
*/

// Sheldon-NodeRed-1033._hap._tcp.local

bonjour.find({
  type: 'hap'
}, function(service) {
  debug('Found an HTTP server:', service.name);
});
