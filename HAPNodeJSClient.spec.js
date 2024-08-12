const { _responseLineRegex } = require('./lib/httpParser');

var HAPNodeJSClient = require('hap-node-client').HAPNodeJSClient;

const testDeviceID = "CC:22:3D:E3:CF:33";
const testAccessoryStatus = "?id=9.10";
const testAccessoryControlOff = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "value": 0 }] });
const testAccessoryControlOn = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "value": 1 }] });

const testAccessoryEventFail = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 9, "ev": true }] });
const testAccessoryEventOn = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "ev": true }] });

const testResourceDeviceID = "7E:94:75:31:A2:DD";
const testResourceMessage = JSON.stringify({ "resource-type": "image", "image-width": 1920, "image-height": 1080 });

describe("Constructor Test", () => {
  test("Load with empty contructor", async () => {
    expect(() => new HAPNodeJSClient()).toThrow(TypeError);
  });

  test("Set default pin to 123-456-789", async () => {
    expect(() => new HAPNodeJSClient({ pin: "123-456-789" }));
  });

});

/*

curl -X PUT http://192.168.1.11:46775/accessories --header "Content-Type:Application/json" --header "authorization: 031-45-154"
curl -X GET http://192.168.1.11:46775/characteristics?id=9.10 --header "Content-Type:Application/json" --header "authorization: 031-45-154"
*/


describe("Correct PIN", () => {

  let homebridges;

  beforeAll(() => {
    var options = {
    };
    homebridges = new HAPNodeJSClient(options);
  });

  describe("Discover Accessories", () => {
    test("Retrieve Accessories", done => {
      console.log('This takes 20 seconds');
      homebridges.on('Ready', function () {

        homebridges.HAPaccessories(function (endPoints) {
          // console.log("alexaDiscovery", endPoints);
          // console.log("Test Endpoint", JSON.stringify(endPoints.find(endpoint => endpoint.deviceID === testDeviceID).accessories, null, 2));
          expect((endPoints.length > 1 ? true : false)).toEqual(true);
          done();
        });
      });
    }, 21000);
  });

  describe("HAPeventByDeviceID", () => {

    test("register for events - fail", done => {
      homebridges.HAPeventByDeviceID(testDeviceID, testAccessoryEventFail, function (err, response) {
        // console.log('HAPeventByDeviceID - fail', err, response, 'success is -70406');
        expect(err).toBeNull();
        // { characteristics: [ { aid: 9, iid: 9, status: -70406 } ] }
        expect(response.characteristics[0].status).toEqual(-70406);
        done();
      });
    });

    test("register for events", done => {
      homebridges.HAPeventByDeviceID(testDeviceID, testAccessoryEventOn, function (err, response) {
        // console.log('HAPeventByDeviceID', err, response, 'success is null')
        expect(err).toBeNull();
        expect(response).toBeNull();
        done();
      });

    });
  });

  describe("HAPstatusByDeviceID", () => {
    test("invalid deviceID", done => {

      homebridges.HAPstatusByDeviceID("12:34:56:78", "{ a: 1 }", function (err, response) {
        // console.log("HAPstatusByDeviceID", err.message, response);
        expect(err.message).toEqual('ERROR: HB Instance not found');
        expect(response).toBeUndefined();
        done();
      });
    });

    test("valid deviceID, and valid body", done => {

      homebridges.HAPstatusByDeviceID(testDeviceID, testAccessoryStatus, function (err, response) {
        // console.log("HAPstatusByDeviceID", err, response);
        expect(err).toBeNull();
        expect(response).toHaveProperty('characteristics');
        done();
      });
    });

    // This test will trigger a instance cache refresh, and break every thing for 20 seconds

    test("valid deviceID, but invalid body", done => {

      homebridges.HAPstatusByDeviceID(testDeviceID, "{ a: 1 }", function (err, response) {
        // console.log("HAPstatusByDeviceID", err.message, response);
        expect(err.message).toEqual('Homebridge Status failed');
        expect(response).toBeUndefined();
        done();
      });
    });

    test("Pause 21 seconds for instance cache refresh", done => {
      setTimeout(() => {
        done();
      }, 21000);
    }, 21100);
  });

  describe("HAPcontrolByDeviceID", () => {
    test("valid deviceID, and valid body On", done => {

      homebridges.HAPcontrolByDeviceID(testDeviceID, testAccessoryControlOn, function (err, response) {
        // console.log("HAPcontrolByDeviceID", err, response);
        expect(err).toBeNull();
        expect(response).toBeNull();
        done();
      });
    });

    test("valid deviceID, and valid body Off", done => {

      homebridges.HAPcontrolByDeviceID(testDeviceID, testAccessoryControlOff, function (err, response) {
        // console.log("HAPcontrolByDeviceID", err, response);
        expect(err).toBeNull();
        expect(response).toBeNull();
        done();
      });
    });


  });

  describe("HAPresourceByDeviceID", () => {
    test("valid deviceID, and valid message", done => {

      homebridges.HAPresourceByDeviceID(testResourceDeviceID, testResourceMessage, function (err, response) {
        // console.log("HAPresourceByDeviceID", err, response, response.length);
        expect(err).toBeNull();
        expect(response.length).toBeGreaterThan(10000);
        done();
      });
    });
  });
});

describe("Incorrect PIN", () => {

  let homebridges;

  beforeAll(() => {
    var options = {
      pin: "123-456-789"
    };
    homebridges = new HAPNodeJSClient(options);
  });

  describe("Discover Accessories", () => {
    test("Retrieve Accessories", done => {
      console.log('This takes 20 seconds');
      homebridges.on('Ready', function () {

        homebridges.HAPaccessories(function (endPoints) {
          // console.log("alexaDiscovery", endPoints);
          // console.log("Test Endpoint", JSON.stringify(endPoints.find(endpoint => endpoint.deviceID === testDeviceID).accessories, null, 2));
          expect((endPoints.length > 1 ? true : false)).toEqual(true);
          done();
        });
      });
    }, 21000);
  });

  describe("HAPeventByDeviceID", () => {

    test("register for events - fail", done => {
      homebridges.HAPeventByDeviceID(testDeviceID, testAccessoryEventFail, function (err, response) {
        // console.log('HAPeventByDeviceID - fail', err, response, 'success is -70406');
        // expect(err).toBeNull();
        expect(err.message).toMatch('Homebridge auth failed, invalid PIN');
        expect(response).toBeUndefined();
        done();
      });
    });

    test("Pause 21 seconds for instance cache refresh", done => {
      setTimeout(() => {
        done();
      }, 21000);
    }, 21100);

    test("register for events", done => {
      homebridges.HAPeventByDeviceID(testDeviceID, testAccessoryEventOn, function (err, response) {
        // console.log('HAPeventByDeviceID', err, response, 'success is null')
        expect(err.message).toMatch('Homebridge auth failed, invalid PIN');
        expect(response).toBeUndefined();
        done();
      });
    });

    test("Pause 21 seconds for instance cache refresh", done => {
      setTimeout(() => {
        done();
      }, 21000);
    }, 21100);

  });

  describe("HAPstatusByDeviceID", () => {
    test("invalid deviceID", done => {

      homebridges.HAPstatusByDeviceID("12:34:56:78", "{ a: 1 }", function (err, response) {
        // console.log("HAPstatusByDeviceID", err.message, response);
        expect(err.message).toEqual('ERROR: HB Instance not found');
        expect(response).toBeUndefined();
        done();
      });
    });

    test("Pause 21 seconds for instance cache refresh", done => {
      setTimeout(() => {
        done();
      }, 21000);
    }, 21100);


    test("valid deviceID, and valid body", done => {

      homebridges.HAPstatusByDeviceID(testDeviceID, testAccessoryStatus, function (err, response) {
        // console.log("HAPstatusByDeviceID", err, response);
        expect(err).toBeNull();
        expect(response).toHaveProperty('characteristics');
        done();
      });
    });

    // This test will trigger a instance cache refresh, and break every thing for 20 seconds

    test("valid deviceID, but invalid body", done => {

      homebridges.HAPstatusByDeviceID(testDeviceID, "{ a: 1 }", function (err, response) {
        // console.log("HAPstatusByDeviceID", err.message, response);
        expect(err.message).toEqual('Homebridge Status failed');
        expect(response).toBeUndefined();
        done();
      });
    });

    test("Pause 21 seconds for instance cache refresh", done => {
      setTimeout(() => {
        done();
      }, 21000);
    }, 21100);
  });

  describe("HAPcontrolByDeviceID", () => {
    test("valid deviceID, and valid body On", done => {

      homebridges.HAPcontrolByDeviceID(testDeviceID, testAccessoryControlOn, function (err, response) {
        // console.log("HAPcontrolByDeviceID", err, response);
        expect(err.message).toMatch('Homebridge auth failed, invalid PIN');
        expect(response).toBeUndefined();
        done();
      });
    });

    test("Pause 21 seconds for instance cache refresh", done => {
      setTimeout(() => {
        done();
      }, 21000);
    }, 21100);

    test("valid deviceID, and valid body Off", done => {

      homebridges.HAPcontrolByDeviceID(testDeviceID, testAccessoryControlOff, function (err, response) {
        // console.log("HAPcontrolByDeviceID", err, response);
        expect(err.message).toMatch('Homebridge auth failed, invalid PIN');
        expect(response).toBeUndefined();
        done();
      });
    });

    test("Pause 21 seconds for instance cache refresh", done => {
      setTimeout(() => {
        done();
      }, 21000);
    }, 21100);

  });

  describe("HAPresourceByDeviceID", () => {
    test("valid deviceID, and valid message", done => {

      homebridges.HAPresourceByDeviceID(testResourceDeviceID, testResourceMessage, function (err, response) {
        // console.log("HAPresourceByDeviceID", err, response, ( response ? response.length : 'undefined'));
        expect(err.message).toMatch('Homebridge auth failed, invalid PIN');
        expect(response).toBeUndefined();
        done();
      });
    });
  });
});


describe.only("Filter", () => {

  describe("Filter None", () => {

    let homebridges;

    beforeAll(() => {
      var options = {
      };
      homebridges = new HAPNodeJSClient(options);
    });

    describe("Discover Accessories", () => {
      test("Retrieve Accessories", done => {
        console.log('This takes 20 seconds');
        homebridges.on('Ready', function () {

          homebridges.HAPaccessories(function (endPoints) {
            // console.log("alexaDiscovery Single", endPoints, endPoints.length);
            // console.log("Test Endpoint", JSON.stringify(endPoints.find(endpoint => endpoint.deviceID === testDeviceID).accessories, null, 2));
            expect(endPoints.length).toBeGreaterThan(2);
            done();
          });
        });
      }, 21000);
    });

  });

  describe("Filter Single", () => {

    let homebridges;

    beforeAll(() => {
      var options = {
        filter: "192.168.1.11:51551"
      };
      homebridges = new HAPNodeJSClient(options);
    });

    describe("Discover Accessories", () => {
      test("Retrieve Accessories", done => {
        console.log('This takes 20 seconds');
        homebridges.on('Ready', function () {

          homebridges.HAPaccessories(function (endPoints) {
            // console.log("alexaDiscovery Single", endPoints, endPoints.length);
            // console.log("Test Endpoint", JSON.stringify(endPoints.find(endpoint => endpoint.deviceID === testDeviceID).accessories, null, 2));
            expect(endPoints.length).toEqual(1);
            done();
          });
        });
      }, 21000);
    });

  });

  describe("Filter Dual", () => {

    let homebridges;

    beforeAll(() => {
      var options = {
        filter: "192.168.1.11:51551, 192.168.1.11:46047"
      };
      homebridges = new HAPNodeJSClient(options);
    });

    describe("Discover Accessories", () => {
      test("Retrieve Accessories", done => {
        console.log('This takes 20 seconds');
        homebridges.on('Ready', function () {

          homebridges.HAPaccessories(function (endPoints) {
            // console.log("alexaDiscovery Dual", endPoints, endPoints.length);
            // console.log("Test Endpoint", JSON.stringify(endPoints.find(endpoint => endpoint.deviceID === testDeviceID).accessories, null, 2));
            expect(endPoints.length).toEqual(2);
            done();
          });
        });
      }, 21000);
    });

  });
});