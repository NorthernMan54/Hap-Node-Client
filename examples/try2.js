var bonjour = require('../node_modules/bonjour-hap')();
var debug = require('../node_modules/debug')("try2");
var ip = require('ip');
var mdnsCache = [];

var discovered = [];

_discovery();

function _discovery() {
  this.timeout = 8;

  debug("Starting Homebridge instance discovery");
  populateCache(this.timeout, function() {
    debug("Hey", mdnsCache);
    for (var i in mdnsCache) {
      mdnsLookup(i, function(err, response) {
        console.log(response);
      })
    }
  });
}

function _discoveryEnd() {
  debug("Ending Homebridge instance discovery");
  // debug("This", this);
  this.emit('Ready', discovered);
  this.browser.stop();
}

function _getAccessories(serviceName, callback) {
  mdnsLookup(serviceName, function(err, serviceObject) {
    if (err) {
      console.log("ERROR:", err);
    } else {
      console.log("HB", serviceName, serviceObject.url);
      callback(true, {
        accessories: []
      });
    }
  });
}

function mdnsLookup(serviceName, callback) {
  debug("\nmdnsLookup start", serviceName);
  if (mdnsCache[serviceName]) {
    debug('cached', mdnsCache[serviceName].url);
    callback(null, mdnsCache[serviceName]);
  } else {
    populateCache(4, function() {
      if (mdnsCache[serviceName]) {
        debug('refreshed', mdnsCache[serviceName].url);
        callback(null, mdnsCache[serviceName]);
      } else {
        callback(new Error("ERROR: HB Instance not found", serviceName), null);
      }
    });
  }
}

function populateCache(timeout, callback) {
  var browser = bonjour.find({
    type: 'hap'
  }, function(result) {
    debug('Found an HAP server:', result.name);
    if (result.txt) {
      var ipAddress, url;

      for (const address of result.addresses) {
        if (ip.isV4Format(address) && address.substring(0, 7) !== "169.254") {
          ipAddress = address;
          url = "http://" + ipAddress + ":" + result.port + "/";
          break;
        } else if (ip.isV6Format(address)) {
          ipAddress = address;
          url = "http://[" + ipAddress + "]:" + result.port + "/";
        }
      }
      mdnsCache[result.name] = {
        host: ipAddress,
        port: result.port,
        url: url,
        name: result.name
      };
    }
  });
  setTimeout(function() {
    debug('Timeout:');
    browser.stop();
    callback();
  }, timeout * 1000);
}
