var HAPNodeJSClient = require('hap-node-client').HAPNodeJSClient;

/*
describe("HAPNodeJSClient load", () => {
  test("test HAPNodeJSClient import", () => {
    expect(true).toBeTruthy();
  });
});
*/

const testDeviceID = "CC:22:3D:E3:CF:33";
const testAccessoryStatus = "?id=9.10";
const testAccessoryControlOff = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "value": 0 }] });
const testAccessoryControlOn = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "value": 1 }] });

const testResourceDeviceID = "7E:94:75:31:A2:DD";
const testResourceMessage = JSON.stringify({ "resource-type": "image", "image-width": 1920, "image-height": 1080 });


jest.setTimeout(25000);

describe("Constructor Test", () => {
  test("Load with empty contructor", async () => {
    expect(() => new HAPNodeJSClient()).toThrow(TypeError);
  });

  test("Set default pin to 123-456-789", async () => {
    expect(() => new HAPNodeJSClient({ pin: "123-456-789" }));
  });

});


describe("Discover Accessories", () => {

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
          expect((endPoints.length > 1 ? true : false)).toEqual(true);
          done();
        });
      });
    });
  });

  describe("HAPstatusByDeviceID", () => {
    test("HAPstatusByDeviceID with invalid deviceID", done => {

      homebridges.HAPstatusByDeviceID("12:34:56:78", "{ a: 1 }", function (err, response) {
        // console.log("HAPstatusByDeviceID", err.message, response);
        expect(err.message).toEqual('ERROR: HB Instance not found');
        expect(response).toBeUndefined();
        done();
      });
    });

/*
    test("HAPstatusByDeviceID with valid deviceID, but invalid body", done => {
  
      homebridges.HAPstatusByDeviceID(testDeviceID, "{ a: 1 }", function (err, response) {
        console.log("HAPstatusByDeviceID", err.message, response);
        expect(err.message).toEqual('Homebridge Status failed');
        expect(response).toBeUndefined();
        done();
      });
    });
*/ 

    test("HAPstatusByDeviceID with valid deviceID, and valid body", done => {

      homebridges.HAPstatusByDeviceID(testDeviceID, testAccessoryStatus, function (err, response) {
        // console.log("HAPstatusByDeviceID", err, response);
        expect(err).toBeNull();
        expect(response).toHaveProperty('characteristics');
        done();
      });
    });


  });

  describe("HAPcontrolByDeviceID", () => {
    test("HAPcontrolByDeviceID with valid deviceID, and valid body On", done => {

      homebridges.HAPcontrolByDeviceID(testDeviceID, testAccessoryControlOn, function (err, response) {
        // console.log("HAPcontrolByDeviceID", err, response);
        expect(err).toBeNull();
        expect(response).toBeNull();
        done();
      });
    });

    test("HAPcontrolByDeviceID with valid deviceID, and valid body Off", done => {

      homebridges.HAPcontrolByDeviceID(testDeviceID, testAccessoryControlOff, function (err, response) {
        // console.log("HAPcontrolByDeviceID", err, response);
        expect(err).toBeNull();
        expect(response).toBeNull();
        done();
      });
    });


  });

  describe("HAPresourceByDeviceID", () => {
    test("HAPresourceByDeviceID with valid deviceID, and valid message", done => {

      homebridges.HAPresourceByDeviceID(testResourceDeviceID, testResourceMessage, function (err, response) {
        // console.log("HAPresourceByDeviceID", err, response, response.length);
        expect(err).toBeNull();
        expect(response.length).toBeGreaterThan(10000);
        done();
      });
    });
  });
});