'use strict';

// External Libraries

const ip = require('ip');
const bonjour = require('bonjour-hap')();
const axios = require('axios').default;
const inherits = require('node:util').inherits;
const axiosRetry = require('axios-retry').default;
const EventEmitter = require('node:events').EventEmitter;

// Internal Libaries

const hapRequest = require('./lib/hapRequest.js');
const normalizeUUID = require('./lib/util.js').normalizeUUID;
const getAccessoryDump = require('./lib/getAccessoryDump').getAccessoryDump;
const MonitorBridgeUpdates = require('./lib/monitorBridgeUpdates').MonitorBridgeUpdates;

// Debug Monitoring

var debug = require('debug')('HAPNodeJSClient');
var debugDis = require('debug')('HAPNodeJSClient:Discover');
var debugDump = require('debug')('HAPNodeJSClient:Dump');

axiosRetry(axios, { retries: 3 });

var discovered = [];
// var mdnsCache = {};
var populateCache = false;

var filter = false;
var pins = {};

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
 * @property {number} type - Type of mDNS record to look for, defaults to `hap`, used for testing only.
 * @example
 *
 */

var populateCacheTimeout;

class HAPNodeJSClient {
  constructor(options) {
    // console.log('Options', options);
    this.options = options;
    this.debug = options.debug || false;
    this.refresh = options.refresh || 900;
    this.timeout = options.timeout || 20;
    this.reqTimeout = options.reqTimeout || 7000;
    this.RegisterPin('default', options.pin || '031-45-154');
    filter = options.filter || false;
    if (this.debug) {
      let debugEnable = require('debug');
      let namespaces = debugEnable.disable();

      // this.log('DEBUG-1', namespaces);
      if (namespaces) {
        namespaces = namespaces + ',hap*';
      } else {
        namespaces = 'hap*';
      }
      // this.log('DEBUG-2', namespaces);
      debugEnable.enable(namespaces);
    }

    this.eventRegistry = {};

    this.monitorBridgeUpdates = new MonitorBridgeUpdates({ type: (options.type ? options.type : 'hap') });

    this.monitorBridgeUpdates.on('up', this.bridgeUp.bind(this));
    this.monitorBridgeUpdates.on('update', this.bridgeUpdate.bind(this));
    this.monitorBridgeUpdates.on('Ready', this.bridgeReady.bind(this));

    // _discovery.call(this);  // Inital discovery of devices
    this._eventBus = new EventEmitter();
    // this.discoveryTimer = setInterval(_discovery.bind(this), this.refresh * 1000);

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

    this._eventBus.on('Event', function (events) {
      debug('Events', JSON.stringify(events));
      /**
       * HomeKit Accessory Characteristic event pass thru
       *
       * @event HAPNodeJSClient#hapEvent
       * @Type  {object}
       * @property {string} host - IP Address of homebridge instance generating event
       * @property {number} port - Port of homebridge instance generating event
       * @property {number} deviceID - deviceID of homebridge instance generating event
       * @property {number} aid - Accessory ID of accessory generating event
       * @property {number} iid - Instance ID of accessory characteristic generating event
       * @property {object} value - Updated characteristic value
       * @example Sample Message
       *
       * [{"host":"192.168.1.13","port":43787,"deviceID":"76:59:CE:25:B9:6E","aid":1,"iid":13,"value":true,"status":true}]
       */
      this.emit('hapEvent', events);
      this.emit(events[0].host + events[0].port + events[0].aid, events);
      events.forEach(function (event) {
        // debug('hapEvent', event.host + event.port + event.aid + event.iid, event);
        this.emit(event.host + event.port + event.aid + event.iid, event);
        this.emit(event.deviceID + event.aid + event.iid, event);
      }.bind(this));
    }.bind(this));

    // debug('This', this);
  }

  /**
   * 
   * @param {*} callback 
   */
  async bridgeUp(service) {
    // debugDis('bridgeUp', service);
    if (await this.getServiceDump(service)) {
    }
  }

  /**
   * 
   * @param {*} callback 
   */
  async bridgeUpdate(service) {
    debugDis('bridgeUpdate', service);
    if (await this.getServiceDump(service)) {
      this.emit('Update', _deassociateArray(discovered));
    }
  }

    /**
   * 
   * @param {*} callback 
   */
    async bridgeReady(service) {
      debugDis('bridgeReady %d Homebridge instances', Object.keys(discovered).length);
      if (Object.keys(discovered).length > 0) {
        this.emit('Ready', _deassociateArray(discovered));
      }
    }

  /**
 * 
 * @param {*} callback 
 */
  async getServiceDump(service) {
    // debugDis('getServiceDump', service);
    if ((filter && filter === service.host + ':' + service.port) || !filter) {
      try {
        let serviceDump = await getAccessoryDump(service);
        if (serviceDump) {
          //          debugDis('discovered', service.deviceID, bridge);
          discovered[service.deviceID] = serviceDump;
        }
        return serviceDump;
      } catch (err) {
        debugDis('ERROR:', err.message, service.name);
      }
    } else {
      debugDump('Filtered HAP instance address: %s -> %s', service.txt.md, service.url);
    }
  }

  /**
   * RegisterPin - Register pin numbers ()
   *
   * @class
   * @param  {type} key  Unique identifier of homebridge instance (ip:port or deviceID)
   * @param  {type} pin  Homebridge PIN
   * @return {type} bool updated
   */
  RegisterPin(key, pin) {
    if (!key || (key in pins && pins[key] === pin)) {
      return false;
    }

    key = key.toLowerCase();
    pins[key] = pin;
    debug('Registered/updated PIN for `%s`: %s', key, pin);
    return true;
  }
  /**
   * HAPaccessories - Returns an array of all homebridge instances, and the accessories for each.
   *
   * @class
   * @param  {type} callback description
   * @return {type}          description
   */
  HAPaccessories(callback) {
    // This is a callback as in the future may need to call something
    callback(_deassociateArray(discovered));
  }
  /**
   * mdnsCache
   *
   * @returns mdnsCacheObject
   */
  mdnsCache() {
    return this.monitorBridgeUpdates.mdnsCache;
  }

  // curl -X PUT http://127.0.0.1:51826/characteristics --header "Content-Type:Application/json"
  // --header "authorization: 031-45-154" --data "{ \"characteristics\": [{ \"aid\": 2, \"iid\": 9, \"value\": 0}] }"
  /**
   * HAPcontrolByDeviceID - Send a characteristic PUT Message to a particular homebridge instance
   *
   * @param  {type} deviceID  deviceID of homebridge instance
   * @param  {type} body      An array of HomeKit characteristic updates, [{ \"aid\": 2, \"iid\": 9, \"value\": 0}]
   * @param  {type} callback  Callback to execute upon completion of characteristic setting, function(err, response)
   */
  HAPcontrolByDeviceID(deviceID, body, callback) {
    this._mdnsLookup(deviceID, function (err, instance) {
      if (err) {
        callback(err);
      } else {
        this.HAPcontrol.call(this, instance.host, instance.port, body, function (err, response) {
          if (err) {
            this._mdnsError(deviceID);
          }
          callback(err, response);
        }, instance);
      }
    }.bind(this));
  }
  /**
   * HAPcontrol - Send a characteristic PUT Message to a particular homebridge instance
   *
   * @param  {type} ipAddress IP Address of homebridge instance
   * @param  {type} port      Port of homebridge instance
   * @param  {type} body      An array of HomeKit characteristic updates, [{ \"aid\": 2, \"iid\": 9, \"value\": 0}]
   * @param  {type} callback  Callback to execute upon completion of characteristic setting, function(err, response)
   */
  HAPcontrol(ipAddress, port, body, callback, instance) {
    axios({
      eventBus: this._eventBus,
      method: 'PUT',
      url: instance.url + '/characteristics',
      timeout: this.reqTimeout,
      headers: {
        'Content-Type': 'Application/json',
        'authorization': _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port),
        'connection': 'keep-alive'
      },
      data: body,
      validateStatus: function (status) {
        return true; // Resolve only if the status code is less than 500
      }
    }).then(function (response) {
      // debug('HAPcontrol-then', response.status, response.statusText, response.headers, response.data, response.config);
      switch (response.status) {
        case 204:
          callback(null, null);
          break;
        case 207:
          callback(null, response.data);
          break;
        case 401:
        case 470:
          debug('Homebridge auth failed, invalid PIN %s %s:%s', _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port), ipAddress, port, body, response.data);
          callback(new Error('Homebridge auth failed, invalid PIN ' + _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port)));
          break;
        default:
          debug('Homebridge Control failed %s:%s Status: %s ', ipAddress, port, response.status, body, response.data);
          callback(new Error('Homebridge control failed'));
      }
    }).catch(function (err) {
      // Response s/b 200 OK
      debug('HAPcontrol-catch', err);
      debug('Homebridge Control failed %s:%s', ipAddress, port, body, err.message);
      callback(err);
    });
  }
  /**
   * HAPeventByDeviceID - Send a characteristic PUT Message to a particular homebridge instance, this maintains a socket connection for use in returning Events
   *
   * @param  {type} deviceID  deviceID homebridge instance
   * @param  {type} body      An array of HomeKit characteristic updates, [{ \"aid\": 2, \"iid\": 9, \"value\": 0}]
   * @param  {type} callback  Callback to execute upon completion of characteristic setting, function(err, response)
   */
  HAPeventByDeviceID(deviceID, body, callback) {
    // console.log('This-0', this);
    this._mdnsLookup(deviceID, function (err, instance) {
      // debug('This-1', instance);
      if (err) {
        callback(err);
      } else {

        hapRequest({
          eventBus: this._eventBus,
          method: 'PUT',
          deviceID: deviceID,
          url: instance.url + '/characteristics',
          timeout: this.reqTimeout,
          headers: {
            'Content-Type': 'Application/json',
            'authorization': _findPinByKey(deviceID),
            'connection': 'keep-alive'
          },
          body: body
        }, function (err, response) {
          // Response s/b 200 OK
          // debug('HAPeventByDeviceID %s:%s', instance.host, instance.port, response);
          if (err) {
            debug('Homebridge event reg failed %s:%s', instance.host, instance.port, body, err.message);
            this._mdnsError(deviceID);
            callback(err);
          } else if (response.statusCode !== 207 && response.statusCode !== 204) {
            if (response.statusCode === 401 || response.statusCode === 470) {
              debug('Homebridge auth failed, invalid PIN %s', _findPinByKey(deviceID), deviceID, body, err, response.body);
              this._mdnsError(deviceID);
              callback(new Error('Homebridge auth failed, invalid PIN ' + _findPinByKey(deviceID)));
            } else {
              debug('Homebridge event reg failed %s:%s Status: %s ', deviceID, response.statusCode, body, err, response.body);
              this._mdnsError(deviceID);
              callback(new Error('Homebridge event reg failed'));
            }
          } else {
            var rsp;

            if (!this.eventRegistry[deviceID]) {
              this.eventRegistry[deviceID] = [];
            }
            // debug('1', JSON.parse(body).characteristics);
            this.eventRegistry[deviceID] = this.eventRegistry[deviceID].concat(JSON.parse(body).characteristics);
            // debug('2', JSON.stringify(this.eventRegistry[key]));
            this.eventRegistry[deviceID].sort((a, b) => (JSON.stringify(a) > JSON.stringify(b)) ? 1 : ((JSON.stringify(b) > JSON.stringify(a)) ? -1 : 0));
            // debug('3', JSON.stringify(this.eventRegistry[key]));
            this.eventRegistry[deviceID] = Array.from(new Set(this.eventRegistry[deviceID].map(JSON.stringify))).map(JSON.parse);
            // debug('4', JSON.stringify(this.eventRegistry[key]));
            try {
              rsp = JSON.parse(response.body);
            } catch (ex) {
              debug('Homebridge Response Failed %s:%s', deviceID, response.statusCode, response.statusMessage);
              debug('Homebridge Response Failed %s:%s', deviceID, response.body, ex);

              callback(new Error(ex));
              return;
            }
            callback(null, rsp);
          }
        }.bind(this));
      }
    }.bind(this));
  }
  /**
   * HAPevent - Send a characteristic PUT Message to a particular homebridge instance, this maintains a socket connection for use in returning Events
   *
   * @param  {type} ipAddress IP Address of homebridge instance
   * @param  {type} port      Port of homebridge instance
   * @param  {type} body      An array of HomeKit characteristic updates, [{ \"aid\": 2, \"iid\": 9, \"value\": 0}]
   * @param  {type} callback  Callback to execute upon completion of characteristic setting, function(err, response)
   */
  HAPevent(ipAddress, port, body, callback, instance) {
    hapRequest({
      eventBus: this._eventBus,
      method: 'PUT',
      url: instance.url + '/characteristics',
      timeout: this.reqTimeout,
      headers: {
        'Content-Type': 'Application/json',
        'authorization': _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port),
        'connection': 'keep-alive'
      },
      body: body
    }, function (err, response) {
      // Response s/b 200 OK
      if (err) {
        debug('Homebridge event reg failed %s:%s', ipAddress, port, body, err.message);
        callback(err);
      } else if (response.statusCode !== 207 && response.statusCode !== 204) {
        if (response.statusCode === 401 || response.statusCode === 470) {
          debug('Homebridge auth failed, invalid PIN %s %s:%s', _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port), ipAddress, port, body, err, response.body);
          callback(new Error('Homebridge auth failed, invalid PIN ' + _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port)));
        } else {
          debug('Homebridge event reg failed %s:%s Status: %s ', ipAddress, port, response.statusCode, body, err, response.body);
          callback(new Error('Homebridge event reg failed'));
        }
      } else {
        var rsp;

        var key = ipAddress + ':' + port;
        if (!this.eventRegistry[key]) {
          this.eventRegistry[key] = [];
        }
        // debug('1', JSON.parse(body).characteristics);
        this.eventRegistry[key] = this.eventRegistry[key].concat(JSON.parse(body).characteristics);
        // debug('2', JSON.stringify(this.eventRegistry[key]));
        this.eventRegistry[key].sort((a, b) => (JSON.stringify(a) > JSON.stringify(b)) ? 1 : ((JSON.stringify(b) > JSON.stringify(a)) ? -1 : 0));
        // debug('3', JSON.stringify(this.eventRegistry[key]));
        this.eventRegistry[key] = Array.from(new Set(this.eventRegistry[key].map(JSON.stringify))).map(JSON.parse);
        // debug('4', JSON.stringify(this.eventRegistry[key]));
        try {
          rsp = JSON.parse(response.body);
        } catch (ex) {
          debug('Homebridge Response Failed %s:%s', ipAddress, port, response.statusCode, response.statusMessage);
          debug('Homebridge Response Failed %s:%s', ipAddress, port, response.body, ex);

          callback(new Error(ex));
          return;
        }
        callback(null, rsp);
      }
    }.bind(this));
  }
  /**
   * HAPresourceByDeviceID - Send a characteristic PUT Message to a particular homebridge instance using resource interface, ie camera
   *
   * @param  {type} DeviceID  DeviceID of homebridge instance
   * @param  {type} body      An array of HomeKit characteristic updates, [{ \"aid\": 2, \"iid\": 9, \"value\": 0}]
   * @param  {type} callback  Callback to execute upon completion of characteristic setting, function(err, response)
   */
  HAPresourceByDeviceID(deviceID, body, callback) {
    // console.log('This-0', this);
    this._mdnsLookup(deviceID, function (err, instance) {
      // console.log('This-1', this);
      if (err) {
        callback(err);
      } else {
        this.HAPresource.call(this, instance.host, instance.port, body, function (err, response) {
          if (err) {
            this._mdnsError(deviceID);
          }
          callback(err, response);
        }.bind(this), instance);
      }
    }.bind(this));
  }
  /**
   * HAPresource - Send a characteristic PUT Message to a particular homebridge instance using resource interface, ie camera
   *
   * @param  {type} ipAddress IP Address of homebridge instance
   * @param  {type} port      Port of homebridge instance
   * @param  {type} body      An array of HomeKit characteristic updates, [{ \"aid\": 2, \"iid\": 9, \"value\": 0}]
   * @param  {type} callback  Callback to execute upon completion of characteristic setting, function(err, response)
   */
  HAPresource(ipAddress, port, body, callback, instance) {

    axios({
      eventBus: this._eventBus,
      method: 'POST',
      url: instance.url + '/resource',
      timeout: this.reqTimeout,
      responseType: 'arraybuffer',
      headers: {
        'Content-Type': 'Application/json',
        'authorization': _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port),
        'connection': 'keep-alive'
      },
      data: body,
      validateStatus: function (status) {
        return true; // Resolve only if the status code is less than 500
      }
    }).then(function (response) {
      // debug('HAPcontrol-then', response.status, response.statusText, response.headers, response.config);
      switch (response.status) {
        case 200:
          callback(null, response.data);
          break;
        case 401:
        case 470:
          debug('Homebridge auth failed, invalid PIN %s %s:%s', _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port), ipAddress, port, body, response.data);
          callback(new Error('Homebridge auth failed, invalid PIN ' + _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port)));
          break;
        default:
          debug('Homebridge Resource failed %s:%s Status: %s ', ipAddress, port, response.status, body, response.data);
          callback(new Error('Homebridge Resource failed'));
      }
    }).catch(function (err) {
      // Response s/b 200 OK
      debug('HAPcontrol-catch', err);
      debug('Homebridge Resource failed %s:%s', ipAddress, port, body, err.message);
      callback(err);
    });
  }
  /**
   * HAPstatusByDeviceID - Get current status for characteristics
   *
   * @param  {type} deviceID  deviceID of homebridge instance
   * @param  {type} body      description
   * @param  {type} callback  Callback to execute upon completion of characteristic getting, function(err, response)
   */
  HAPstatusByDeviceID(deviceID, body, callback) {
    // console.log('This-0', this);
    this._mdnsLookup(deviceID, function (err, instance) {
      // console.log('This-1', this);
      if (err) {
        callback(err);
      } else {
        this.HAPstatus.call(this, instance.host, instance.port, body, function (err, response) {
          if (err) {
            this._mdnsError(deviceID);
          }
          callback(err, response);
        }.bind(this), instance);
      }
    }.bind(this));
  }
  /**
   * HAPstatus - Get current status for characteristics
   *
   * @param  {type} ipAddress IP Address of homebridge instance
   * @param  {type} port      Port of homebridge instance
   * @param  {type} body      description
   * @param  {type} callback  Callback to execute upon completion of characteristic getting, function(err, response)
   */
  HAPstatus(ipAddress, port, body, callback, instance) {

    axios({
      eventBus: this._eventBus,
      method: 'GET',
      url: instance.url + '/characteristics' + body,
      timeout: this.reqTimeout,
      headers: {
        'Content-Type': 'Application/json',
        'authorization': _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port),
        'connection': 'keep-alive'
      },
      validateStatus: function (status) {
        return true; // Resolve only if the status code is less than 500
      }
    }).then(function (response) {
      //  debug('HAPstatus-then', response.status, response.statusText, response.headers, response.data, response.config);
      switch (response.status) {
        case 200:
          callback(null, response.data);
          break;
        case 207:
          callback(null, response.data);
          break;
        case 401:
        case 470:
          debug('Homebridge auth failed, invalid PIN %s %s:%s', _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port), ipAddress, port, body, response.data);
          callback(new Error('Homebridge auth failed, invalid PIN ' + _findPinByKey(instance ? instance.deviceID : ipAddress + ':' + port)));
          break;
        default:
          debug('Homebridge Status failed %s:%s Status: %s ', ipAddress, port, response.status, body, response.data);
          callback(new Error('Homebridge Status failed'));
      }
    }).catch(function (err) {
      // Response s/b 200 OK
      debug('HAPstatus-catch', err);
      debug('Homebridge Status failed %s:%s', ipAddress, port, body, err.message);
      callback(err);
    });
  }

  /**
   *  When a 'known' bridge is not found, force refresh the cache
   * 
   * @param {*} deviceID 
   * @param {*} callback 
   */
  async _mdnsLookup(deviceID, callback) {
    // debug('\nmdnsLookup start', serviceName);
    if (this.monitorBridgeUpdates.mdnsCacheGet(deviceID)) {
      // debug('cached', this.monitorBridgeUpdates.mdnsCacheGet(serviceName].url);
      callback(null, this.monitorBridgeUpdates.mdnsCacheGet(deviceID));
    } else {
      debug('_mdnsLookup missing', deviceID);
      await this.monitorBridgeUpdates.refreshCache();
      if (this.monitorBridgeUpdates.mdnsCacheGet(deviceID)) {
        // debug('cached', this.monitorBridgeUpdates.mdnsCacheGet(serviceName].url);
        callback(null, this.monitorBridgeUpdates.mdnsCacheGet(deviceID));
      } else {
        callback(new Error('ERROR: HB Instance not found', deviceID), null);
      }
    };
  }

  async _mdnsError(deviceID) {
    debug('_mdnsError ', deviceID);
    this.monitorBridgeUpdates.mdnsCacheRemove(deviceID);
    this.monitorBridgeUpdates.refreshCache();
  }

  /**
   * Destroy and shutdown HAPNodeJSClient - Used by testing
   */
  async destroy() {
    clearInterval(this.discoveryTimer);
    clearInterval(populateCacheTimeout);
    bonjour.destroy();
    this.monitorBridgeUpdates.destroy();
  }
}

inherits(HAPNodeJSClient, EventEmitter);

/*
function _discovery() {
  debug('Starting Homebridge instance discovery');
  discovered = [];
  // debug('this-0', this);
  _populateCache(this.timeout, _getAccessories, function () {
    debug('Ready');
    this.emit('Ready', discovered);
  }.bind(this));
}
*/

/*
function _populateCache(timeout, discovery, callback) {
  debug('_populateCache', populateCache);
  if (!populateCache) {
    populateCache = true;
    // debug('_populateCache', new Error().stack);
    var browser = bonjour.find({
      type: 'test'
    }, function (result) {
      if (result.txt) {
        debug('HAP Device discovered', result.name, result.addresses);
        var ipAddress, url;

        for (const address of result.addresses) {
          if (ip.isV4Format(address) && address.substring(0, 7) !== '169.254') {
            ipAddress = address;
            url = 'http://' + ipAddress + ':' + result.port;
            break;    // prefer ipv4
          } else if (ip.isV6Format(address) && address.substring(0, 7) !== '169.254' && address.substring(0, 6) !== 'fe80::') {
            // ipv6 with Axios is broken on MacOS - 
            // ipAddress = address;
            // url = 'http://[' + ipAddress + ']:' + result.port;
          } else {
            debug('Invalid address found', result.name, address, result.addresses);
          }
        }
        if (url) {
          this.monitorBridgeUpdates.mdnsCacheUpdate({
            name: result.name,
            host: ipAddress,
            port: result.port,
            url: url,
            deviceID: result.txt.id,
            txt: result.txt
          });
          if (discovery) {
            discovery.call(this, this.monitorBridgeUpdates.mdnsCacheGet(result.txt.id), function () { });
          }
        } else {
          debug('No address found', result.name, result.addresses);
        }
      } else {
        debug('Unsupported device found, skipping', result.name);
      }
    });
    populateCacheTimeout = setTimeout(function () {
      // debug('Timeout:');
      browser.stop();
      populateCache = false;
      callback();
    }, timeout * 1000);
  } else {
    callback();
  }
}*/

function _findPinByKey(key) {
  if (!key) {
    return pins['default'];
  }

  key = key.toLowerCase();
  return pins[key] || pins['default'];
}

/**
 * _reconnectServer - Reconnect to event server
 *
 * @param  {type} server IP Address and port of disconnected homebridge server
 * @return {type}        description
 */

function _reconnectServer(server) {
  debug('HAPevent events Reregister', server, this.eventRegistry);
  // debug('This', this, server);
  var events = [];
  if (this.eventRegistry.length) {
    this.eventRegistry[server.deviceID].forEach(function (device) {
      events.push({
        deviceID: server.deviceID,
        aid: device.aid,
        iid: device.iid,
        status: -70402
      });
    });
  }
  this.emit('hapEvent', events);
  // this.emit(events[0].host + events[0].port + events[0].aid, events);
  events.forEach(function (event) {
    // debug('hapEvent', event.host + event.port + event.aid + event.iid, event);
    // this.emit(event.host + event.port + event.aid + event.iid, event);
    this.emit(event.deviceID + event.aid + event.iid, event);
  }.bind(this));
  var reconnectTimer;
  if (server.deviceID) {
    reconnectTimer = setInterval(function () {
      this.HAPeventByDeviceID(server.deviceID, JSON.stringify({
        characteristics: this.eventRegistry[server.deviceID]
      }), clearTimer.bind(this));
    }.bind(this), 60000);
  } else {
    reconnectTimer = setInterval(function () {
      this.HAPevent(server.server.split(':')[0], server.server.split(':')[1], JSON.stringify({
        characteristics: this.eventRegistry[server.server]
      }), clearTimer.bind(this));
    }.bind(this), 60000);
  }

  function clearTimer(err, rsp) {
    var events = [];
    if (err) {
      debug('HAPevent event reregister failed, retry in 60', server);
      /*
       *
       * [{"host":"192.168.1.13","port":43787,"deviceID":"76:59:CE:25:B9:6E","aid":1,"iid":13,"value":true,"status":true}]
       */
      debug('clearTimer', server, this.eventRegistry[server.deviceID]);
      if (this.eventRegistry.length) {
        this.eventRegistry[server.deviceID].forEach(function (device) {
          events.push({
            deviceID: server.deviceID,
            aid: device.aid,
            iid: device.iid,
            status: -70402
          });
        });
      }
      this.emit('hapEvent', events);
      // this.emit(events[0].host + events[0].port + events[0].aid, events);
      events.forEach(function (event) {
        // debug('hapEvent', event.host + event.port + event.aid + event.iid, event);
        // this.emit(event.host + event.port + event.aid + event.iid, event);
        this.emit(event.deviceID + event.aid + event.iid, event);
      }.bind(this));
    } else {
      debug('HAPevent event reregister succeeded', server);
      if (this.eventRegistry.length) {
        this.eventRegistry[server.deviceID].forEach(function (device) {
          events.push({
            deviceID: server.deviceID,
            aid: device.aid,
            iid: device.iid,
            status: true
          });
        });
      }
      this.emit('hapEvent', events);
      // this.emit(events[0].host + events[0].port + events[0].aid, events);
      events.forEach(function (event) {
        // debug('hapEvent', event.host + event.port + event.aid + event.iid, event);
        // this.emit(event.host + event.port + event.aid + event.iid, event);
        this.emit(event.deviceID + event.aid + event.iid, event);
      }.bind(this));
      clearInterval(reconnectTimer);
    }
  }
}

module.exports = {
  HAPNodeJSClient: HAPNodeJSClient
};

/*
function _getAccessories(instance, callback) {
  // debug('_getAccessories()', filter, instance.url + '/accessories');
  if ((filter && filter === instance.host + ':' + instance.port) || !filter) {
    var host = instance.host + ':' + instance.port;

    axios({
      eventBus: this._eventBus,
      method: 'GET',
      url: instance.url + '/accessories',
      timeout: this.reqTimeout,
      retryDelay: 5000, // (default) wait for 5s before trying again
      headers: {
        'Content-Type': 'Application/json',
        'authorization': _findPinByKey(instance.deviceID ? instance.deviceID : instance.host + ':' + instance.port),
        'connection': 'keep-alive'
      },
      validateStatus: function (status) {
        return true; // Resolve only if the status code is less than 500
      }
    }).then(function (response) {

      switch (response.status) {
        case 200:
          // debug('_getAccessories-then-else', response.status,response.statusText, response.headers, response.data);

          try {
            // var message = normalizeUUID(JSON.parse(response.data.replace(/\uFFFD/g, '')));  // Fix for invalid ascii returned as part of a device name
            var message = normalizeUUID(response.data);
          } catch (err) {
            debug('HAP Json Msg Parse failed %s %s error code %s', instance.txt.md, instance.url, response.status);
            callback(err);
            return;
          }
          if (message && Object.keys(message.accessories)) {   // && await _checkInstanceConnection(instance)
            debug('Homebridge instance discovered %s @ %s with %s accessories', instance.name, instance.url, Object.keys(message.accessories).length);
            discovered.push({
              ipAddress: instance.host,
              instance: instance,
              accessories: message,
              deviceID: instance.deviceID,
              name: instance.txt.md
            });
            callback(null);
          } else {
            debug('Short json data received %s -> %s', instance.txt.md, instance.url, JSON.stringify(response));
            callback(new Error('Short json data received %s -> %s', instance.txt.md, instance.url));
          }
          break;
        case 401:
        case 470:
          debug('HAP Discover failed %s -> %s invalid PIN or homebridge is not running in insecure mode with -I', instance.txt.md, instance.url);
          callback(new Error('homebridge is not running in insecure mode with -I', response.status));
          break;
        default:
          debug('HAP Discover failed %s -> %s http status code %s', instance.txt.md, instance.url, response.status);
          debug('Message-1', response);
          callback(new Error('Http Err', response.status));
      }

    }).catch(function (err) {
      // Response s/b 200 OK
      debug('_getAccessories-catch', err);
      callback(err);
    });
  } else {
    debug('Filtered HAP instance address: %s -> %s', instance.txt.md, instance.url);
  }
}
*/

function _deassociateArray(original) {
  var result = [];
  for (var item in original) {
    result.push(original[item]);
  }
  // console.log('Result', result);
  return (result);
}



/**
 * This checks the instance pin matches
 */
async function _checkInstanceConnection(instance) {
  try {
    await axios.put(`http://${instance.host}:${instance.port}/characteristics`,
      {
        characteristics: [{ aid: -1, iid: -1 }],
      },
      {
        headers: {
          Authorization: _findPinByKey(instance ? instance.deviceID : instance.host + ':' + instance.port),
        },
      }
    );
    return true;
  } catch (e) {
    throw 'Incorrect PIN \'' + _findPinByKey(instance ? instance.deviceID : instance.host + ':' + instance.port) + '\'';
    return false;
  }
}