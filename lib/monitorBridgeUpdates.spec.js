
const MonitorBridgeUpdates = require('./monitorBridgeUpdates').MonitorBridgeUpdates;

// mDNS Records

var bonjour = require('bonjour-hap')()

// test variables

let publishTxt = {
  "c#": 1,
  ff: 0,
  id: 'JE:ST:TE:ST:AC',
  md: 'MonitorBridgeUpdatesTestAccessory',
  pv: '1.1',
  "s#": 1, // current state number (must be 1)
  sf: '0',
  ci: 2,
  sh: 'setupHash'
};

const testType = 'test';

const publishOptions = {
  name: 'MonitorBridgeUpdates_Test_Accessory',
  type: testType,
  port: 3000,
  host: 'MonitorBridgeUpdatesTestAccessory.local',
  txt: publishTxt
}

const testDeviceID = "CC:22:3D:E3:CF:33";
const testAccessoryStatus = "?id=9.10";
const testAccessoryControlOff = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "value": 0 }] });
const testAccessoryControlOn = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "value": 1 }] });

const testAccessoryEventFail = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 9, "ev": true }] });
const testAccessoryEventOn = JSON.stringify({ "characteristics": [{ "aid": 9, "iid": 10, "ev": true }] });

const testResourceDeviceID = "7E:94:75:31:A2:DD";
const testResourceMessage = JSON.stringify({ "resource-type": "image", "image-width": 1920, "image-height": 1080 });

/*

curl -X PUT http://192.168.1.11:46775/accessories --header "Content-Type:Application/json" --header "authorization: 031-45-154"
curl -X GET http://192.168.1.11:46775/characteristics?id=9.10 --header "Content-Type:Application/json" --header "authorization: 031-45-154"
*/

describe("MonitorBridgeUpdates", () => {

  let monitorBridgeUpdates;
  let service;

  beforeAll(() => {
    monitorBridgeUpdates = new MonitorBridgeUpdates({ type: testType});
  });

  describe("Publish Test Accessory", () => {
    const upMock = jest.fn((data) => { }); // console.log('called', data)
    const updateMock = jest.fn((data) => { }); // console.log('called', data)
    const downMock = jest.fn((data) => { }); // console.log('called', data)
    beforeAll(() => {
      monitorBridgeUpdates.on('up', upMock);
      monitorBridgeUpdates.on('update', updateMock);
      monitorBridgeUpdates.on('down', downMock);
    });
    test('Test Accessory', done => {
      service = bonjour.publish(publishOptions);
      service.start()
      expect(service).toBeDefined();
      expect(service).toHaveProperty('name', 'MonitorBridgeUpdates_Test_Accessory');
      service.on('up', async function () {
        // console.log(service);
        expect(service.published).toBeTruthy();
        service.removeAllListeners('up');
        done();
      })
      expect(updateMock).toHaveBeenCalledTimes(0);
      expect(downMock).toHaveBeenCalledTimes(0);
    });
    afterAll(() => {
      monitorBridgeUpdates.removeListener('up', upMock);
      monitorBridgeUpdates.removeListener('update', updateMock);
      monitorBridgeUpdates.removeListener('down', downMock);
    });
  });

  describe("Increment TXT c#", () => {
    const upMock = jest.fn((data) => { }); // console.log('called', data)
    const updateMock = jest.fn((data) => { }); // console.log('called', data)
    const downMock = jest.fn((data) => { }); // console.log('called', data)
    beforeAll(() => {
      monitorBridgeUpdates.on('up', upMock);
      monitorBridgeUpdates.on('update', updateMock);
      monitorBridgeUpdates.on('down', downMock);
    });
    test("Catch event when an accessory C# changes", async () => {
      upMock.mockClear();

      publishTxt['c#'] = publishTxt['c#'] + 1;
      service.updateTxt(publishTxt)      
      await sleep(500);
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock.mock.calls[0][0]).toHaveProperty('name', 'MonitorBridgeUpdates_Test_Accessory');
      expect(updateMock.mock.calls[0][0].txt).toHaveProperty('c#', '2');
      expect(upMock).toHaveBeenCalledTimes(1);    // Something in memory with bonjour is triggering this
      expect(downMock).toHaveBeenCalledTimes(0);
      // console.log(callbackMock.mock.calls);
      // console.log('TXT - After', service.txt);
    });
    afterAll(() => {
      monitorBridgeUpdates.removeListener('up', upMock);
      monitorBridgeUpdates.removeListener('update', updateMock);
      monitorBridgeUpdates.removeListener('down', downMock);
    });
  });

/* {
  addresses: [Array],
  name: 'Jest_Test_Accessory',
  fqdn: 'Jest_Test_Accessory._test._tcp.local',
  host: 'jestTestAccessory.local',
  referer: [Object],
  port: 3000,
  type: 'test',
  protocol: 'tcp',
  subtypes: [],
  rawTxt: [Array],
  txt: [Object]
}
*/


  afterAll(async () => {
    await bonjour.unpublishAll(async function (err) {
      if (err)
        console.log('unpublishAll', err);
      bonjour.destroy();
    });
    await sleep(500);
    await monitorBridgeUpdates.destroy();
  }, 30000);


});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
