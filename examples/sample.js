var HAPNodeJSClient = require('../HAPNodeJSClient.js').HAPNodeJSClient;
var debug = require('../node_modules/debug')('sample');
var resolver = require('../node_modules/mdns-resolver');
var Queue = require('../node_modules/better-queue');

var mdnsCache = [];

var queue = new Queue(function(request, cb) {
  mdnsLookup(request, cb);
}, {
  concurrent: 1,
  autoResume: true
});

var options = {
  // clientId: this.username,
  debug: true,
  refresh: 40, // Seconds
  timeout: 5, // Seconds
  reqTimeout: 7000, // Milli seconds
  pin: '031-45-154',
  filter: false
};

var homebridge = new HAPNodeJSClient(options);

// resolver.resolvePtr('_hap._tcp.local').then(function(service) {
//  debug('resolvePtr', service);
// });

homebridge.on('Ready', function() {
  alexaDiscovery.call(options, null, function() {
    // debug("Events", options);

  });
});

function alexaDiscovery(message, callback) {
  // debug('alexaDiscovery', this);
  homebridge.HAPaccessories(function(endPoints) {
    debug("-------------------------------------------------------");
    debug("alexaDiscovery", endPoints.length);
    var response;

    endPoints.forEach(function(entry) {
      // console.log(entry.hapService);
      queue.push(entry.hapService, function(err, data) {
        if (err) {
          debug('mdnsLookup FAILED', entry.hapService, err.message);
        } else {
          debug('mdnsLookup', entry.hapService, data);
        }
      });
    });

    // debug("Discovery Response", JSON.stringify(response, null, 4));
    callback(null, response);
  }.bind(this));
}

function mdnsLookup(serviceName, callback) {
  debug("\nmdnsLookup start", serviceName);
  if (mdnsCache[serviceName]) {
    debug('cached', mdnsCache[serviceName]);
    callback(null, mdnsCache[serviceName]);
  } else {
    resolver.resolveSrv(serviceName).then(function(service) {
      debug('resolve', service);
      resolver.resolve4(service.target).then(function(host) {
        // debug('resolve4', host);
        mdnsCache[serviceName] = {
          host: host,
          port: service.port
        };
        callback(null, mdnsCache[serviceName]);
      }, function(err) {
        // console.log('REJECT', err.message);
        callback(err);
      });
    }, function(err) {
      // console.log('REJECT', err.message);
      callback(err);
    });
  }
}
