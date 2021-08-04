//
// Sample discovery fragment
//

var HAPNodeJSClient = require('../HAPNodeJSClient.js').HAPNodeJSClient;

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

homebridge.on('Ready', function() {
  homebridge.HAPaccessories(function(endPoints) {
    console.log("-------------------------------------------------------");
    console.log("Found", endPoints.length);

    endPoints.forEach(function(entry) {
      console.log(entry);
    });
  });
});
