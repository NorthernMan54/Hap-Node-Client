//
// Sample discovery fragment
//

var HAPNodeJSClient = require('../HAPNodeJSClient.js').HAPNodeJSClient;

const testDeviceID = "CC:22:3D:E3:CF:33";
const testAccessoryStatus = "?id=9.10";
const testAccessoryControlOff = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "value": 0 }] });
const testAccessoryControlOn = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "value": 1 }] });

const testAccessoryEventOn = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "ev": true }] });

const testResourceDeviceID = "7E:94:75:31:A2:DD";
const testResourceMessage = JSON.stringify({ "resource-type": "image", "image-width": 1920, "image-height": 1080 });

var options = {
  // clientId: this.username,
  debug: true,
  refresh: 40, // Seconds
  timeout: 15, // Seconds
  reqTimeout: 7000, // Milli seconds
  pin: '031-45-154',
  filter: false
};

var homebridge = new HAPNodeJSClient(options);

homebridge.on('Ready', function () {
  homebridge.HAPaccessories(function (endPoints) {
    console.log("-------------------------------------------------------");
    console.log("Found", endPoints.length);

    var count = 0;
    endPoints.forEach(function (entry) {
      count += entry.accessories.accessories.length;
    });
    console.log('total - ', count);

    homebridge.HAPeventByDeviceID(testDeviceID, testAccessoryEventOn, function (response) { console.log('HAPeventByDeviceID', response, 'success is null') });

    homebridge.HAPcontrolByDeviceID(testDeviceID, testAccessoryControlOn, function (response) { console.log('HAPcontrolByDeviceID', response, 'success is null') });
    homebridge.HAPcontrolByDeviceID(testDeviceID, testAccessoryControlOff, function (response) { console.log('HAPcontrolByDeviceID', response, 'success is null') });

    homebridge.HAPstatusByDeviceID(testDeviceID, testAccessoryStatus, function (err, response) { console.log('HAPstatusByDeviceID', response, err) });

    homebridge.HAPresourceByDeviceID(testResourceDeviceID, testResourceMessage, function (err, status) { console.log('err', err, 'status', status); });

 // This will trigger a device cache cleanup, and any calls within the next 20 seconds will fail.

    homebridge.HAPstatusByDeviceID(testDeviceID, "{ a: 1 }", function (err, response) {
      console.log("HAPstatusByDeviceID - should fail", err.message, response);
    });

  });
});