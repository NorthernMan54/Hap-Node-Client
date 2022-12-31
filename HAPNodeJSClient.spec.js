var HAPNodeJSClient = require('hap-node-client').HAPNodeJSClient;

/*
describe("HAPNodeJSClient load", () => {
  test("test HAPNodeJSClient import", () => {
    expect(true).toBeTruthy();
  });
});
*/

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

  beforeEach(() => {
    var options = {
    };
    homebridges = new HAPNodeJSClient(options);
  });

  test("Retrieve Accessories", async () => {

    homebridges.on('Ready', function () {

      homebridges.HAPaccessories(function (endPoints) {
        console.log("alexaDiscovery", endPoints);

      });
    });

  });
});