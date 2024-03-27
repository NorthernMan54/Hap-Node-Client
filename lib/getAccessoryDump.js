'use strict';

// External Libraries

const axios = require('axios').default;

// Internal Libaries

const normalizeUUID = require('./util.js').normalizeUUID;

// Debug Monitoring

const debugGetAcc = require('debug')('hapNodeJSClient:getAcc');

let filter = '';
let reqTimeout = 5000;

async function getAccessoryDump(instance) {
  // debugGetAcc('_getAccessories()', filter, instance.url + '/accessories');
  if (instance.url) {
    try {
      let response = await axios({
        //     eventBus: this._eventBus,
        method: 'GET',
        url: instance.url + '/accessories',
        timeout: reqTimeout,
        retryDelay: 5000, // (default) wait for 5s before trying again
        headers: {
          'Content-Type': 'Application/json',
          //        'authorization': _findPinByKey(instance.deviceID ? instance.deviceID : instance.host + ':' + instance.port),
          'connection': 'keep-alive'
        },
        validateStatus: function (status) {
          return true; // Resolve only if the status code is less than 500
        }
      });

      switch (response.status) {
        case 200:
          // debugGetAcc('_getAccessories-then-else', response.status,response.statusText, response.headers, response.data);

          try {
            // var message = normalizeUUID(JSON.parse(response.data.replace(/\uFFFD/g, '')));  // Fix for invalid ascii returned as part of a device name
            var message = normalizeUUID(response.data);
          } catch (err) {
            debugGetAcc('HAP Json Msg Parse failed %s %s error code %s', instance.txt.md, instance.url, response.status);
            callback(err);
            return;
          }
          if (message && Object.keys(message.accessories)) {   // && await _checkInstanceConnection(instance)
            debugGetAcc('Homebridge instance discovered %s @ %s with %s accessories', instance.name, instance.url, Object.keys(message.accessories).length);
            return {
              ipAddress: instance.host,
              instance: instance,
              accessories: message.accessories,
              deviceID: instance.deviceID,
              name: instance.txt.md
            }
          } else {
            debugGetAcc('Short json data received %s -> %s', instance.txt.md, instance.url, JSON.stringify(response));
            throw new Error('Short json data received %s -> %s', instance.txt.md, instance.url);
          }
          break;
        case 401:
        case 470:
          debugGetAcc('HAP Discover failed %s -> %s invalid PIN or homebridge is not running in insecure mode with -I', instance.txt.md, instance.url);
          throw new Error('homebridge is not running in insecure mode with -I \"' + instance.txt.md + '\" (' + instance.url + ')');
          break;
        default:
          debugGetAcc('HAP Discover failed %s -> %s http status code %s', instance.txt.md, instance.url, response.status);
          debugGetAcc('Message-1', response);
          throw new Error('Http Err', response.status);
      }
    } catch (err) {
      debugGetAcc('_getAccessories-catch', err);
      throw err;
    }
  } else {
    debugGetAcc('Missing address', instance.txt.md, instance.name);
  }
}

exports.getAccessoryDump = getAccessoryDump;