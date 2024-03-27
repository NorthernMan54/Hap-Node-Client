const ip = require('ip');
const util = require('util')
const bonjour = require('bonjour-hap')()
const dnsEqual = require('./dnsEqual')
const EventEmitter = require('events').EventEmitter;

// Debug logging

const debugMon = require('debug')('HAPNodeJSClient:Monitor');

class MonitorBridgeUpdates {
  constructor(options) {
    this.mdnsCache = [];
    debugMon('Starting Browser with - ', options);
    this.browser = bonjour.find(options);
    this.browser.on('up', (service) => {
      const cacheRecord = this.mdnsCacheUpdate(service);
      if (cacheRecord) {
        debugMon('HAP Device discovered - %s {c#: %d} referer: ', service.name, service.txt['c#'], service.referer);
        this.emit('up', cacheRecord);
      }
    })

    this.browser.on('update', (service) => {
      // Dedup updates, as they can be noisy
      const cachedService = this.mdnsCacheGet(service.txt.id);
      if (!cachedService) return
      if (objectEquals(cachedService.txt, service.txt)) return

      const cacheRecord = this.mdnsCacheUpdate(service);
      if (cacheRecord) {
        debugMon('Service update - %s {c#: %d} referer: ', service.name, service.txt['c#'], service.referer);
        this.emit('update', cacheRecord);
      }
    })

    this.browser.on('down', (service) => {
      const cacheRecord = this.mdnsCacheUpdate(service);
      if (cacheRecord) {
        debugMon('Service down', service.name);
        this.emit('down', cacheRecord);
      }
    })
  }

  async destroy() {
    this.browser.stop()
    bonjour.destroy();
    debugMon('MonitorBridgeUpdates - destroyed');
  }

  mdnsCacheGet(id) {
    return this.mdnsCache[id];
  }

  mdnsCacheUpdate(service) {
    var ipAddress = getIpAddress(service);
    if (ipAddress) {
      this.mdnsCache[service.txt.id] = {
        name: service.name,
        host: ipAddress,
        port: service.port,
        url: 'http://' + ipAddress + ':' + service.port,
        deviceID: service.txt.id,
        txt: service.txt,
        configNum: service.txt['c#']
      };
    } else {
      debugMon('No address found', service.name, service.addresses);
    }
    return this.mdnsCache[service.txt.id];
  }

  mdnsCacheRemove(id) {
    throw new Error('mdnsCacheRemove - Not implemented');
  }
}

util.inherits(MonitorBridgeUpdates, EventEmitter)
module.exports = { MonitorBridgeUpdates: MonitorBridgeUpdates }

// Borrowed from https://stackoverflow.com/questions/201183/how-can-i-determine-equality-for-two-javascript-objects/16788517#16788517

function getIpAddress(service) {
  let ipAddress;
  for (const address of service.addresses) {
    if (ip.isV4Format(address) && address.substring(0, 7) !== '169.254') {
      ipAddress = address;
      break;    // prefer ipv4
    } else if (ip.isV6Format(address) && address.substring(0, 7) !== '169.254' && address.substring(0, 6) !== 'fe80::') {
      // ipv6 with Axios is broken on MacOS - 
      // ipAddress = address;
      // url = 'http://[' + ipAddress + ']:' + result.port;
    }
  }

  // if (!ipAddress) { debugMon('Invalid address found', service.name, service.addresses); }
  return ipAddress;
}

function objectEquals(x, y) {
  'use strict';

  if (x === null || x === undefined || y === null || y === undefined) { return x === y; }
  // after this just checking type of one would be enough
  if (x.constructor !== y.constructor) { return false; }
  // if they are functions, they should exactly refer to same one (because of closures)
  if (x instanceof Function) { return x === y; }
  // if they are regexps, they should exactly refer to same one (it is hard to better equality check on current ES)
  if (x instanceof RegExp) { return x === y; }
  if (x === y || x.valueOf() === y.valueOf()) { return true; }
  if (Array.isArray(x) && x.length !== y.length) { return false; }

  // if they are dates, they must had equal valueOf
  if (x instanceof Date) { return false; }

  // if they are strictly equal, they both need to be object at least
  if (!(x instanceof Object)) { return false; }
  if (!(y instanceof Object)) { return false; }

  // recursive object equality check
  var p = Object.keys(x);
  return Object.keys(y).every(function (i) { return p.indexOf(i) !== -1; }) &&
    p.every(function (i) { return objectEquals(x[i], y[i]); });
}