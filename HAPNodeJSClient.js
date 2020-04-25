"use strict";

var request = require('requestretry');
// var request = require('./lib/hapRequest.js');
var hapRequest = require('./lib/hapRequest.js');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var debug = require('debug')('hapNodeJSClient');
var bonjour = require('bonjour')();
var ip = require('ip');
var normalizeUUID = require('./lib/util.js').normalizeUUID;

var discovered = [];
var mdnsCache = [];

module.exports = {
  HAPNodeJSClient: HAPNodeJSClient
};

/**
 * HAPNodeJSClient - Client for Homebridge and HAP-NodeJS in insecure mode.
 *
 * Events
 *
 * @class
 * @param  {type} options description
 * @Type  {object}
 * @property {boolean} debug - Enable debug logging, defaults to false
 * @property {string} pin - Homebridge PIN, defaults to '031-45-154'
 * @property {number} refresh - Discovery refresh, defaults to 15 minutes
 * @property {number} timeout - Discovery timeout, defaults to 20 seconds
 * @property {number} reqTimeout - Accessory request timeout, defaults to 7 seconds
 * @example
 *
 */

function HAPNodeJSClient(options) {
  // console.log("Options", options);
  this.debug = options['debug'] || false;
  this.refresh = options['refresh'] || 900;
  this.timeout = options['timeout'] || 20;
  this.reqTimeout = options['reqTimeout'] || 7000;
  this.pin = options['pin'] || '031-45-154';
  this.filter = options['filter'] || false;
  if (this.debug) {
    let debugEnable = require('debug');
    let namespaces = debugEnable.disable();

    // this.log("DEBUG-1", namespaces);
    if (namespaces) {
      namespaces = namespaces + ',hap*';
    } else {
      namespaces = 'hap*';
    }
    // this.log("DEBUG-2", namespaces);
    debugEnable.enable(namespaces);
  }
  this.eventRegistry = [];
  _discovery.call(this);
  this._eventBus = new EventEmitter();
  setInterval(_discovery.bind(this), this.refresh * 1000);

  /**
   * HomeKit Accessory Characteristic event pass thru
   *
   * @event HAPNodeJSClient#Disconnected
   * @Type  {object}
   * @property {string} server - IP Address and port of disconnected homebridge
   * @example Sample Message
   *
   * { host: '192.168.1.4', port: 51826, aid: 16, iid: 11, status: false }
   */

  this._eventBus.on('Disconnected', _reconnectServer.bind(this));

  this._eventBus.on('Event', function(events) {
    debug('Events', JSON.stringify(events));
    /**
     * HomeKit Accessory Characteristic event pass thru
     *
     * @event HAPNodeJSClient#hapEvent
     * @Type  {object}
     * @property {string} host - IP Address of homebridge instance generating event
     * @property {number} port - Port of homebridge instance generating event
     * @property {number} aid - Accessory ID of accessory generating event
     * @property {number} iid - Instance ID of accessory characteristic generating event
     * @property {object} value - Updated characteristic value
     * @example Sample Message
     *
     * { host: '192.168.1.4', port: 51826, aid: 16, iid: 11, status: false }
     */
    this.emit('hapEvent', events);
    this.emit(events[0].host + events[0].port + events[0].aid, events);
    events.forEach(function(event) {
      // debug('hapEvent', event.host + event.port + event.aid + event.iid, event);
      this.emit(event.host + event.port + event.aid + event.iid, event);
    }.bind(this));
  }.bind(this));
  // debug("This", this);
}

inherits(HAPNodeJSClient, EventEmitter);

function _discovery() {
  debug("Starting Homebridge instance discovery");
  discovered = [];
  // debug("this-0", this);
  _populateCache(this.timeout, _getAccessories, function() {
    debug("Ready");
    this.emit('Ready', discovered);
  }.bind(this));
}

function _mdnsLookup(serviceName, callback) {
  // debug("\nmdnsLookup start", serviceName);
  if (mdnsCache[serviceName]) {
    // debug('cached', mdnsCache[serviceName].url);
    callback(null, mdnsCache[serviceName]);
  } else {
    _populateCache(4, null, function() {
      if (mdnsCache[serviceName]) {
        debug('refreshed', mdnsCache[serviceName].url);
        callback(null, mdnsCache[serviceName]);
      } else {
        callback(new Error("ERROR: HB Instance not found", serviceName), null);
      }
    });
  }
}

function _populateCache(timeout, discovery, callback) {
  var browser = bonjour.find({
    type: 'hap'
  }, function(result) {
    if (result.txt) {
      debug('HAP Device discovered', result.name);
      var ipAddress, url;

      for (const address of result.addresses) {
        if (ip.isV4Format(address) && address.substring(0, 7) !== "169.254") {
          ipAddress = address;
          url = "http://" + ipAddress + ":" + result.port;
          break;
        } else if (ip.isV6Format(address)) {
          ipAddress = address;
          url = "http://[" + ipAddress + "]:" + result.port;
        }
      }
      // debug("result", result);
      mdnsCache[result.txt.md] = {
        host: ipAddress,
        port: result.port,
        url: url,
        name: result.txt.md,
        txt: result.txt
      };
      discovery.call(this, mdnsCache[result.txt.md], function() {});
    } else {
      debug("Unsupported device found, skipping", result.name);
    }
  });
  setTimeout(function() {
    // debug('Timeout:');
    browser.stop();
    callback();
  }, timeout * 1000);
}

/**
 * HAPNodeJSClient.prototype.HAPaccessories - Returns an array of all homebridge instances, and the accessories for each.
 *
 * @class
 * @param  {type} callback description
 * @return {type}          description
 */

HAPNodeJSClient.prototype.HAPaccessories = function(callback) {
  // This is a callback as in the future may need to call something
  callback(discovered);
};

// curl -X PUT http://127.0.0.1:51826/characteristics --header "Content-Type:Application/json"
// --header "authorization: 031-45-154" --data "{ \"characteristics\": [{ \"aid\": 2, \"iid\": 9, \"value\": 0}] }"

HAPNodeJSClient.prototype.HAPcontrolByName = function(homebridgeName, body, callback) {
  _mdnsLookup(homebridgeName, function(err, instance) {
    if (err) {
      callback(err);
    } else {
      HAPNodeJSClient.prototype.HAPcontrol.call(this, instance.host, instance.port, body, callback);
    }
  }.bind(this));
};

/**
 * HAPNodeJSClient.prototype.HAPcontrol - Send a characteristic PUT Message to a particular homebridge instance
 *
 * @param  {type} ipAddress IP Address of homebridge instance
 * @param  {type} port      Port of homebridge instance
 * @param  {type} body      An array of HomeKit characteristic updates, [{ \"aid\": 2, \"iid\": 9, \"value\": 0}]
 * @param  {type} callback  Callback to execute upon completion of characteristic setting, function(err, response)
 */

HAPNodeJSClient.prototype.HAPcontrol = function(ipAddress, port, body, callback) {
  request({
    eventBus: this._eventBus,
    method: 'PUT',
    url: 'http://' + ipAddress + ':' + port + '/characteristics',
    timeout: this.reqTimeout,
    maxAttempts: 1, // (default) try 5 times
    headers: {
      "Content-Type": "Application/json",
      "authorization": this.pin,
      "connection": "keep-alive"
    },
    body: body
  }, function(err, response) {
    // Response s/b 200 OK

    if (err) {
      debug("Homebridge Control failed %s:%s", ipAddress, port, body, err.message);
      callback(err);
    } else if (response.statusCode !== 207 && response.statusCode !== 204) {
      if (response.statusCode === 401 || response.statusCode === 470) {
        debug("Homebridge auth failed, invalid PIN %s %s:%s", this.pin, ipAddress, port, body, err, response.body);
        callback(new Error("Homebridge auth failed, invalid PIN " + this.pin));
      } else {
        debug("Homebridge Control failed %s:%s Status: %s ", ipAddress, port, response.statusCode, body, err, response.body);
        callback(new Error("Homebridge control failed"));
      }
    } else {
      var rsp;
      if (response.statusCode !== 204) {
        try {
          rsp = JSON.parse(response.body);
        } catch (ex) {
          debug("Homebridge Response Failed %s:%s", ipAddress, port, response.statusCode, response.statusMessage);
          debug("Homebridge Response Failed %s:%s", ipAddress, port, response.body, ex);

          callback(new Error(ex));
          return;
        }
      }
      callback(null, rsp);
    }
  });
};

/**
 * _reconnectServer - Reconnect to event server
 *
 * @param  {type} server IP Address and port of disconnected homebridge server
 * @return {type}        description
 */

function _reconnectServer(server) {
  debug("HAPevent events Reregister", server, JSON.stringify(this.eventRegistry[server]));

  var reconnectTimer = setInterval(function() {
    this.HAPevent(server.split(':')[0], server.split(':')[1], JSON.stringify({
      characteristics: this.eventRegistry[server]
    }), clearTimer);
  }.bind(this), 60000);

  function clearTimer(err, rsp) {
    if (err) {
      debug("HAPevent event reregister failed, retry in 60", server, err);
    } else {
      debug("HAPevent event reregister succeeded", server);
      clearInterval(reconnectTimer);
    }
  }
}

HAPNodeJSClient.prototype.HAPeventByName = function(homebridgeName, body, callback) {
  // console.log("This-0", this);
  _mdnsLookup(homebridgeName, function(err, instance) {
      // console.log("This-1", this);
    if (err) {
      callback(err);
    } else {
      HAPNodeJSClient.prototype.HAPevent.call(this, instance.host, instance.port, body, callback);
    }
  }.bind(this));
};

/**
 * HAPNodeJSClient.prototype.HAPevent - Send a characteristic PUT Message to a particular homebridge instance, this maintains a socket connection for use in returning Events
 *
 * @param  {type} ipAddress IP Address of homebridge instance
 * @param  {type} port      Port of homebridge instance
 * @param  {type} body      An array of HomeKit characteristic updates, [{ \"aid\": 2, \"iid\": 9, \"value\": 0}]
 * @param  {type} callback  Callback to execute upon completion of characteristic setting, function(err, response)
 */

HAPNodeJSClient.prototype.HAPevent = function(ipAddress, port, body, callback) {
  hapRequest({
    eventBus: this._eventBus,
    method: 'PUT',
    url: 'http://' + ipAddress + ':' + port + '/characteristics',
    timeout: this.reqTimeout,
    maxAttempts: 1, // (default) try 5 times
    headers: {
      "Content-Type": "Application/json",
      "authorization": this.pin,
      "connection": "keep-alive"
    },
    body: body
  }, function(err, response) {
    // Response s/b 200 OK

    if (err) {
      debug("Homebridge event reg failed %s:%s", ipAddress, port, body, err.message);
      callback(err);
    } else if (response.statusCode !== 207 && response.statusCode !== 204) {
      if (response.statusCode === 401 || response.statusCode === 470) {
        debug("Homebridge auth failed, invalid PIN %s %s:%s", this.pin, ipAddress, port, body, err, response.body);
        callback(new Error("Homebridge auth failed, invalid PIN " + this.pin));
      } else {
        debug("Homebridge event reg failed %s:%s Status: %s ", ipAddress, port, response.statusCode, body, err, response.body);
        callback(new Error("Homebridge event reg failed"));
      }
    } else {
      var rsp;

      var key = ipAddress + ':' + port;
      if (!this.eventRegistry[key]) {
        this.eventRegistry[key] = [];
      }
      // debug("1", JSON.parse(body).characteristics);
      this.eventRegistry[key] = this.eventRegistry[key].concat(JSON.parse(body).characteristics);
      // debug("2", JSON.stringify(this.eventRegistry[key]));
      this.eventRegistry[key].sort((a, b) => (JSON.stringify(a) > JSON.stringify(b)) ? 1 : ((JSON.stringify(b) > JSON.stringify(a)) ? -1 : 0));
      // debug("3", JSON.stringify(this.eventRegistry[key]));
      this.eventRegistry[key] = Array.from(new Set(this.eventRegistry[key].map(JSON.stringify))).map(JSON.parse);
      // debug("4", JSON.stringify(this.eventRegistry[key]));
      try {
        rsp = JSON.parse(response.body);
      } catch (ex) {
        debug("Homebridge Response Failed %s:%s", ipAddress, port, response.statusCode, response.statusMessage);
        debug("Homebridge Response Failed %s:%s", ipAddress, port, response.body, ex);

        callback(new Error(ex));
        return;
      }
      callback(null, rsp);
    }
  }.bind(this));
};

HAPNodeJSClient.prototype.HAPresourceByName = function(homebridgeName, body, callback) {
  // console.log("This-0", this);
  _mdnsLookup(homebridgeName, function(err, instance) {
      // console.log("This-1", this);
    if (err) {
      callback(err);
    } else {
      HAPNodeJSClient.prototype.HAPresource.call(this, instance.host, instance.port, body, callback);
    }
  }.bind(this));
};

/**
 * HAPNodeJSClient.prototype.HAPresource - Send a characteristic PUT Message to a particular homebridge instance using resource interface, ie camera
 *
 * @param  {type} ipAddress IP Address of homebridge instance
 * @param  {type} port      Port of homebridge instance
 * @param  {type} body      An array of HomeKit characteristic updates, [{ \"aid\": 2, \"iid\": 9, \"value\": 0}]
 * @param  {type} callback  Callback to execute upon completion of characteristic setting, function(err, response)
 */

HAPNodeJSClient.prototype.HAPresource = function(ipAddress, port, body, callback) {
  request({
    eventBus: this._eventBus,
    method: 'POST',
    url: 'http://' + ipAddress + ':' + port + '/resource',
    timeout: this.reqTimeout,
    maxAttempts: 1, // (default) try 5 times
    headers: {
      "Content-Type": "Application/json",
      "authorization": this.pin,
      "connection": "keep-alive"
    },
    body: body
  }, function(err, response) {
    // Response s/b 200 OK

    if (err) {
      //      debug("Homebridge Status failed %s:%s", ipAddress, port, body, err);
      callback(err);
    } else if (response.statusCode !== 200) {
      if (response.statusCode === 401 || response.statusCode === 470) {
        debug("Homebridge auth failed, invalid PIN %s %s:%s", this.pin, ipAddress, port, body, err);
        callback(new Error("Homebridge auth failed, invalid PIN " + this.pin));
      } else {
        debug("Homebridge Status failed %s:%s Status: %s ", ipAddress, port, response.statusCode, body, err);
        callback(new Error("Homebridge status failed"));
      }
    } else {
      var rsp;
      try {
        rsp = response.body;
      } catch (ex) {
        debug("Homebridge Response Failed %s:%s", ipAddress, port, response.statusCode, response.statusMessage);
        debug("Homebridge Response Failed %s:%s", ipAddress, port, ex);

        callback(new Error(ex));
        return;
      }
      callback(null, rsp);
    }
  });
};

HAPNodeJSClient.prototype.HAPstatusByName = function(homebridgeName, body, callback) {
  // console.log("This-0", this);
  _mdnsLookup(homebridgeName, function(err, instance) {
      // console.log("This-1", this);
    if (err) {
      callback(err);
    } else {
      HAPNodeJSClient.prototype.HAPstatus.call(this, instance.host, instance.port, body, callback);
    }
  }.bind(this));
};

/**
 * HAPNodeJSClient.prototype.HAPstatus - Get current status for characteristics
 *
 * @param  {type} ipAddress IP Address of homebridge instance
 * @param  {type} port      Port of homebridge instance
 * @param  {type} body      description
 * @param  {type} callback  Callback to execute upon completion of characteristic getting, function(err, response)
 */

HAPNodeJSClient.prototype.HAPstatus = function(ipAddress, port, body, callback) {
  // debug("HAPstatus", this.pin);
  request({
    eventBus: this._eventBus,
    method: 'GET',
    url: 'http://' + ipAddress + ':' + port + '/characteristics' + body,
    timeout: this.reqTimeout,
    maxAttempts: 1, // (default) try 5 times
    headers: {
      "Content-Type": "Application/json",
      "authorization": this.pin,
      "connection": "keep-alive"
    }
  }, function(err, response) {
    // Response s/b 200 OK
    // debug("HAPstatus", 'http://' + ipAddress + ':' + port + '/characteristics' + body);
    // debug("HAPstatus-1", this.pin);
    if (err) {
      //      debug("Homebridge Status failed %s:%s", ipAddress, port, body, err);
      callback(err);
    } else if (response.statusCode !== 207 && response.statusCode !== 200) {
      if (response.statusCode === 401 || response.statusCode === 470) {
        debug("Homebridge auth failed, invalid PIN %s %s:%s", this.pin, ipAddress, port, body, err, response.body);
        callback(new Error("Homebridge auth failed, invalid PIN " + this.pin));
      } else {
        debug("Homebridge Status failed %s:%s Status: %s ", ipAddress, port, response.statusCode, body, err, response.body);
        callback(new Error("Homebridge status failed"));
      }
    } else {
      var rsp;
      try {
        rsp = JSON.parse(response.body);
      } catch (ex) {
        debug("Homebridge Response Failed %s:%s", ipAddress, port, response.statusCode, response.statusMessage);
        debug("Homebridge Response Failed %s:%s", ipAddress, port, response.body, ex);

        callback(new Error(ex));
        return;
      }
      // debug("HAPStatus callback", rsp);
      callback(null, rsp);
    }
  });
};

function _getAccessories(instance, callback) {
  // debug("_getAccessories", 'http://' + ipAddress + ':' + instance.port + '/accessories');
  if ((this.filter && this.filter === instance.host + ":" + instance.port) || !this.filter) {
    request({
      eventBus: this._eventBus,
      method: 'GET',
      url: instance.url + '/accessories',
      timeout: this.reqTimeout,
      maxAttempts: 5, // (default) try 5 times
      retryDelay: 5000, // (default) wait for 5s before trying again
      headers: {
        "Content-Type": "Application/json",
        "authorization": this.pin,
        "connection": "keep-alive"
      }
    }, function(err, response) {
      // Response s/b 200 OK
      // debug("_getAccessories", response);
      if (err || response.statusCode !== 200) {
        if (err) {
          debug("HAP Discover failed %s -> %s error %s", instance.name, instance.url, err.code);
        } else {
          // Status code = 401/470 = homebridge not running in insecure mode
          if (response.statusCode === 401 || response.statusCode === 470) {
            debug("HAP Discover failed %s -> %s invalid PIN or homebridge is not running in insecure mode with -I", instance.name, instance.url);
            err = new Error("homebridge is not running in insecure mode with -I", response.statusCode);
          } else {
            debug("HAP Discover failed %s -> %s http status code %s", instance.name, instance.url, response.statusCode);
            // debug("Message", response);
            err = new Error("Http Err", response.statusCode);
          }
        }
<<<<<<< HEAD
=======
      }
      callback(err);
    } else {
      // debug("_getAccessories", response.body);
      try {
        var message = normalizeUUID(JSON.parse(response.body.replace(/\uFFFD/g, '')));
      } catch (err) {
        debug("HAP Json Msg Parse failed %s http://%s:%s error code %s", instance.txt.md, ipAddress, instance.port, response.statusCode);
>>>>>>> master
        callback(err);
      } else {
        // debug("_getAccessories", response.body);
        try {
          var message = JSON.parse(response.body.replace(/\uFFFD/g, ''));
        } catch (err) {
          debug("HAP Json Msg Parse failed %s %s error code %s", instance.name, instance.url, response.statusCode);
          callback(err);
          return;
        }
        if (message && Object.keys(message.accessories).length > 0) {
          debug("Homebridge instance discovered %s with %s accessories", instance.name, Object.keys(message.accessories).length);
          discovered.push({
            ipAddress: instance.host,
            instance: instance,
            accessories: message,
            hapService: instance.name,
            name: instance.name
          });
          callback(null);
        } else {
          debug("Short json data received %s -> %s", instance.name, instance.url, JSON.stringify(response));
          callback(new Error("Short json data received %s -> %s", instance.name, instance.url));
        }
      }
    });
  } else {
    debug("Filtered HAP instance address: %s -> %s", instance.name, instance.url);
  }
}
