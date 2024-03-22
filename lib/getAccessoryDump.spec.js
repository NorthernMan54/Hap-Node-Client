'use strict';

// External Libraries

var http = require('http');
const axios = require('axios').default;

// Internal Libraries

const getAccessoryDump = require('./getAccessoryDump').getAccessoryDump;

// Test Variables

const testPort = 3000;

let publishTxt = {
  "c#": 1,
  ff: 0,
  id: 'JE:ST:TE:ST:AC',
  md: 'getAccessoryDumpTestAccessory',
  pv: '1.1',
  "s#": 1, // current state number (must be 1)
  sf: '0',
  ci: 2,
  sh: 'setupHash'
};

const testOptions = {
  deviceID: 'aa:bb:cc:dd:ee:ff',
  host: '127.0.0.1',
  port: testPort,
  url: 'http://127.0.0.1:' + testPort,
  txt: publishTxt
}

describe("getAccessoryDump", () => {

  let httpServer;

  beforeAll(() => {
    let app = async function (req, res) {
      console.log('req', req.url);
      switch (req.url) {
        case '/accessories':
          await res.writeHead(200);
          await res.end(JSON.stringify(accessory));
          break;
        default:
          await res.writeHead(200, { 'Content-Type': 'Application/json' });
          await res.end("hello world\n");
      }
    }
    httpServer = http.createServer(app).listen(testPort);
  });

  /*
  {
      ipAddress: '127.0.0.1',
      instance: {
        deviceID: 'aa:bb:cc:dd:ee:ff',
        host: '127.0.0.1',
        port: 3000,
        url: 'http://127.0.0.1:3000',
        txt: {
          'c#': 1,
          ff: 0,
          id: 'JE:ST:TE:ST:AC',
          md: 'getAccessoryDumpTestAccessory',
          pv: '1.1',
          's#': 1,
          sf: '0',
          ci: 2,
          sh: 'setupHash'
        }
      },
      accessories: { accessories: [ [Object], [Object] ] },
      deviceID: 'aa:bb:cc:dd:ee:ff',
      name: 'getAccessoryDumpTestAccessory'
    }

  */

    test("Retrieve Accessories", async () => {
      let bridge = await getAccessoryDump(testOptions);
      // console.log(accessories);
      expect(bridge).toBeDefined();
      expect(bridge).toHaveProperty('ipAddress', '127.0.0.1');
      expect(bridge).toHaveProperty('name', 'getAccessoryDumpTestAccessory');
      expect(bridge).toHaveProperty('accessories');
      expect(bridge.accessories).toHaveLength(2);
    }, 21000);

    test.skip("Retrieve Accessories - incorrect url", async () => {
      let urlTest = testOptions;
      urlTest.url = 'http://sdsd';
      expect(await getAccessoryDump(urlTest)).toThrow();
    }, 21000);

  afterAll(async () => {
    httpServer.closeAllConnections();
    httpServer.close();
  }, 30000);
});


async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Sample Accessory

const accessory = { "accessories": [{ "aid": 1, "services": [{ "type": "3E", "iid": 1, "characteristics": [{ "type": "14", "iid": 2, "perms": ["pw"], "description": "Identify", "format": "bool" }, { "type": "20", "iid": 3, "value": "homebridge.io", "perms": ["pr"], "description": "Manufacturer", "format": "string", "maxLen": 64 }, { "type": "21", "iid": 4, "value": "homebridge", "perms": ["pr"], "description": "Model", "format": "string", "maxLen": 64 }, { "type": "23", "iid": 5, "value": "Heisenberg 4534", "perms": ["pr"], "description": "Name", "format": "string", "maxLen": 64 }, { "type": "30", "iid": 6, "value": "AA:BB:CC:DD:EE:01", "perms": ["pr"], "description": "Serial Number", "format": "string", "maxLen": 64 }, { "type": "52", "iid": 7, "value": "1.7.0", "perms": ["pr"], "description": "Firmware Revision", "format": "string" }] }, { "type": "A2", "iid": 2000000008, "characteristics": [{ "type": "37", "iid": 9, "value": "1.1.0", "perms": ["pr"], "description": "Version", "format": "string", "maxLen": 64 }] }] }, { "aid": 34, "services": [{ "type": "3E", "iid": 1, "characteristics": [{ "type": "14", "iid": 2, "perms": ["pw"], "description": "Identify", "format": "bool" }, { "type": "20", "iid": 3, "value": "homebridge-alexa", "perms": ["pr"], "description": "Manufacturer", "format": "string", "maxLen": 64 }, { "type": "21", "iid": 4, "value": "Default-Model", "perms": ["pr"], "description": "Model", "format": "string", "maxLen": 64 }, { "type": "23", "iid": 5, "value": "Alexa", "perms": ["pr"], "description": "Name", "format": "string", "maxLen": 64 }, { "type": "30", "iid": 6, "value": "Pinkman.local", "perms": ["pr"], "description": "Serial Number", "format": "string", "maxLen": 64 }, { "type": "52", "iid": 7, "value": "0.6.9", "perms": ["pr"], "description": "Firmware Revision", "format": "string" }] }, { "type": "80", "iid": 8, "characteristics": [{ "type": "23", "iid": 9, "value": "Alexa", "perms": ["pr"], "description": "Name", "format": "string", "maxLen": 64 }, { "type": "6A", "iid": 10, "value": 0, "perms": ["ev", "pr"], "description": "Contact Sensor State", "format": "uint8", "minValue": 0, "maxValue": 1, "minStep": 1, "valid-values": [0, 1] }] }] }] };