var resolver = require('../node_modules/mdns-resolver');


resolver.resolveSrv("Sheldon-NodeRed-1033._hap._tcp.local").then(function(host) {
  console.log(host);
});

/*
resolver.resolve4("walter.local").then(function(host) {
  console.log(host);
});
*/

/*
resolver.resolve4("00_01_50_40_03_02_e7_72.local").then(function(host) {
  console.log(host);
});
*/
