var bonjour = require('bonjour-hap')()
const util = require('util')
const dnsEqual = require('./dnsEqual')
var EventEmitter = require('events').EventEmitter;

var debugMon = require('debug')('HAPNodeJSClient:Monitor');

class MonitorBridgeUpdates {
  constructor(options) {
    this.services = [];
    this.browser = bonjour.find( options );
    this.browser.on('up', (service) => {
      this.services.push(service)
    })

    this.browser.on('update', (service) => {
      // Dedup updates, as they can be noisy
      let cachedService, index
      this.services.some(function (s, i) {
        if (dnsEqual(s.fqdn, service.fqdn)) {
          cachedService = s
          index = i
          return true
        }
        return false
      })
      if (!cachedService) return
      if (objectEquals(cachedService.txt, service.txt)) return
      this.services[index] = service
      debugMon('Service update', service.name, service.txt['c#']);
      this.emit('update', service);
    })

    this.browser.on('down', (service) => {
      debugMon('Service down', service.name, service.txt);
    })
  }

  async destroy() {
    this.browser.stop()
    bonjour.destroy();
    debugMon('MonitorBridgeUpdates - destroyed');
  }
}

util.inherits(MonitorBridgeUpdates, EventEmitter)
module.exports = { MonitorBridgeUpdates: MonitorBridgeUpdates }

// Borrowed from https://stackoverflow.com/questions/201183/how-can-i-determine-equality-for-two-javascript-objects/16788517#16788517

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