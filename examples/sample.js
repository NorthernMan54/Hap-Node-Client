//
// Sample discovery fragment
//

var HAPNodeJSClient = require('../HAPNodeJSClient.js').HAPNodeJSClient;

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
      // console.log('sample - ', entry.accessories.accessories.length);
    });
    console.log('total - ', count);
    //    console.log('sample - ', JSON.stringify(endPoints[5], null, 2));
    homebridge.HAPeventByDeviceID("CC:22:3D:E3:CF:33", JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "ev": true }] }), function (response) { console.log('HAPeventByDeviceID', response, 'success is null') });

    homebridge.HAPcontrolByDeviceID("CC:22:3D:E3:CF:33", JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "value": 1 }] }), function (response) { console.log('HAPcontrolByDeviceID', response, 'success is null') });
    //  homebridge.HAPcontrolByDeviceID("CC:22:3D:E3:CF:33", JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "value": 0 }] }), function (response) { console.log('HAPcontrolByDeviceID', response, 'success is null') });
    homebridge.HAPstatusByDeviceID("CC:22:3D:E3:CF:33", "?id=9.10", function (err, response) { console.log('HAPstatusByDeviceID', response, err) });

  //  homebridge.HAPresourceByDeviceID("7E:94:75:31:A2:DD", JSON.stringify({ "resource-type": "image", "image-width": 1920, "image-height": 1080 }), function (err, status) { console.log('err', err, 'status', status); });

  });
});

/*

Dec 27 21:43:02 jesse node-red-pi[958]: hapNodeRed Control 7E:94:75:31:A2:DD -> {"resource-type":"image","image-width":1920,"image-height":1080}
Dec 27 21:43:02 jesse homebridge[8450]: [Camera-ffmpeg] Snapshot from Shed at 1920:1080
Dec 27 21:43:04 jesse node-red-pi[958]: hapNodeRed Controlled 7E:94:75:31:A2:DD -> 1672195382446
homebridge.HAPresourceByDeviceID(device.id, JSON.stringify(message), function (err, status)


*/