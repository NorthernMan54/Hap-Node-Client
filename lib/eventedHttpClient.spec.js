'use strict';

// External Libraries

const http = require('node:http');
const EventEmitter = require('node:events').EventEmitter;

const logSpy = jest.spyOn(console, "log");

// Internal Libraries

const EventedHttpClient = require('./eventedHttpClient');

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

const options = {
  eventBus: new EventEmitter(),
  method: 'PUT',
  deviceID: 'aa:bb:cc:dd:ee:ff',
  url: 'http://192.168.1.121:3000/characteristics',
  timeout: 7000,
  headers: {
    'Content-Type': 'Application/json',
    authorization: '031-45-154',
    connection: 'keep-alive'
  },
  body: '{"characteristics":[{"aid":34,"iid":10,"ev":true},{"aid":35,"iid":10,"ev":true}]}',
  callback: function () { console.log('done') }
}

describe("eventedHttpClient - No Answer", () => {

  let httpServer;

  beforeAll(() => {
    let app = async function (req, res) {
      // console.log('req', req);
      console.log('req', req.socket.remoteAddress, req.method, req.url, req.body);
      switch (req.method) {
        case 'PUT':
          // console.log('req', req.socket.remoteAddress, req.method, req.url, req.body);
          // await res.setHeader("Content-Type", "application/json");
          // await res.writeHead(200);
          // res.end('{"message": "This is a JSON response"}');
          break;
        case 'GET':
          switch (req.url) {
            case '/accessories':
              await res.writeHead(200);
              await res.end(JSON.stringify(accessory));
              break;
            case '/characteristics?id=9.10':
              await res.writeHead(200);
              await res.end(JSON.stringify({ "characteristics": [{ "aid": 2, "iid": 9, "value": 0 }] }));
              break;
            case '/characteristics':
              await res.writeHead(200);
              await res.end(JSON.stringify({ "characteristics": [{ "aid": 2, "iid": 9, "value": 0 }] }));
              break;
            case '/characteristics%7B%20a:%201%20%7D':
              await res.writeHead(500);
              await res.end(JSON.stringify({ "characteristics": [{ "aid": 2, "iid": 9, "value": 0 }] }));
              break;
            default:
              await res.writeHead(200, { 'Content-Type': 'Application/json' });
              await res.end("hello world\n");
          }
          break;
        default:
          await res.writeHead(200, { 'Content-Type': 'Application/json' });
          await res.end("hello world\n");
      }
    }
    httpServer = http.createServer(app).listen(testPort);
  });

  test("Event Register - no listener", done => {
    const disconnectedMock = jest.fn((data) => { }); // console.log('called', data)
    const eventMock = jest.fn((data) => { }); // console.log('called', data)

    let eventBus = new EventEmitter();

    eventBus.on('Event', eventMock);
    eventBus.on('Disconnected', disconnectedMock);

    function callbackMock(err, message) {
      expect(message).toBeUndefined();
      expect(err.message).toBe("connect ECONNREFUSED 192.168.1.121:3001")
      done();
    }

    var client = new EventedHttpClient({
      eventBus: eventBus,
      method: 'PUT',
      deviceID: 'aa:bb:cc:dd:ee:ff',
      url: 'http://192.168.1.121:3001/characteristics',
      timeout: 2000,
      headers: {
        'Content-Type': 'Application/json',
        authorization: '031-45-154',
        connection: 'keep-alive'
      },
      body: '{"characteristics":[{"aid":34,"iid":10,"ev":true},{"aid":35,"iid":10,"ev":true}]}',
      callback: callbackMock
    });
  }, 10000);

  test("Event Register - no answer", done => {
    const disconnectedMock = jest.fn((data) => { }); // console.log('called', data)
    const eventMock = jest.fn((data) => { }); // console.log('called', data)

    let eventBus = new EventEmitter();

    eventBus.on('Event', eventMock);
    eventBus.on('Disconnected', disconnectedMock);

    function callbackMock(err, message) {
      expect(message).toBeUndefined();
      expect(err.message).toBe("Timeout: from server 192.168.1.121:3000")
      done();
    }

    var client = new EventedHttpClient({
      eventBus: eventBus,
      method: 'PUT',
      deviceID: 'aa:bb:cc:dd:ee:ff',
      url: 'http://192.168.1.121:3000/characteristics',
      timeout: 2000,
      headers: {
        'Content-Type': 'Application/json',
        authorization: '031-45-154',
        connection: 'keep-alive'
      },
      body: '{"characteristics":[{"aid":34,"iid":10,"ev":true},{"aid":35,"iid":10,"ev":true}]}',
      callback: callbackMock
    });
  }, 10000);

  afterAll(async () => {
    httpServer.closeAllConnections();
    httpServer.close();
  }, 30000);
});

describe("eventedHttpClient - Bad Response", () => {

  let httpServer;

  beforeAll(() => {
    let app = async function (req, res) {
      // console.log('req', req);
      console.log('req', req.socket.remoteAddress, req.method, req.url, req.body);
      switch (req.method) {
        case 'PUT':
          // console.log('req', req.socket.remoteAddress, req.method, req.url, req.body);
          await res.setHeader("Content-Type", "application/json");
          await res.writeHead(200);
          res.end('{"message": "This is a JSON response"}');
          break;
        case 'GET':
          switch (req.url) {
            case '/accessories':
              await res.writeHead(200);
              await res.end(JSON.stringify(accessory));
              break;
            case '/characteristics?id=9.10':
              await res.writeHead(200);
              await res.end(JSON.stringify({ "characteristics": [{ "aid": 2, "iid": 9, "value": 0 }] }));
              break;
            case '/characteristics':
              await res.writeHead(200);
              await res.end(JSON.stringify({ "characteristics": [{ "aid": 2, "iid": 9, "value": 0 }] }));
              break;
            case '/characteristics%7B%20a:%201%20%7D':
              await res.writeHead(500);
              await res.end(JSON.stringify({ "characteristics": [{ "aid": 2, "iid": 9, "value": 0 }] }));
              break;
            default:
              await res.writeHead(200, { 'Content-Type': 'Application/json' });
              await res.end("hello world\n");
          }
          break;
        default:
          await res.writeHead(200, { 'Content-Type': 'Application/json' });
          await res.end("hello world\n");
      }
    }
    httpServer = http.createServer(app).listen(testPort);
  });

  test.skip("Event Register - no listener", done => {
    const disconnectedMock = jest.fn((data) => { }); // console.log('called', data)
    const eventMock = jest.fn((data) => { }); // console.log('called', data)

    let eventBus = new EventEmitter();

    eventBus.on('Event', eventMock);
    eventBus.on('Disconnected', disconnectedMock);

    function callbackMock(err, message) {
      expect(message).toBeUndefined();
      expect(err.message).toBe("connect ECONNREFUSED 192.168.1.121:3001")
      done();
    }

    var client = new EventedHttpClient({
      eventBus: eventBus,
      method: 'PUT',
      deviceID: 'aa:bb:cc:dd:ee:ff',
      url: 'http://192.168.1.121:3001/characteristics',
      timeout: 2000,
      headers: {
        'Content-Type': 'Application/json',
        authorization: '031-45-154',
        connection: 'keep-alive'
      },
      body: '{"characteristics":[{"aid":34,"iid":10,"ev":true},{"aid":35,"iid":10,"ev":true}]}',
      callback: callbackMock
    });
  }, 10000);

  test("Event Register - no answer", done => {
    const disconnectedMock = jest.fn((data) => { }); // console.log('called', data)
    const eventMock = jest.fn((data) => { }); // console.log('called', data)

    let eventBus = new EventEmitter();

    eventBus.on('Event', eventMock);
    eventBus.on('Disconnected', disconnectedMock);

    function callbackMock(err, message) {
      expect(err).toBeNull();
      expect(message.body).toBe('{\"message\": \"This is a JSON response\"}')
      done();
    }

    var client = new EventedHttpClient({
      eventBus: eventBus,
      method: 'PUT',
      deviceID: 'aa:bb:cc:dd:ee:ff',
      url: 'http://192.168.1.121:3000/characteristics',
      timeout: 2000,
      headers: {
        'Content-Type': 'Application/json',
        authorization: '031-45-154',
        connection: 'keep-alive'
      },
      body: '{"characteristics":[{"aid":34,"iid":10,"ev":true},{"aid":35,"iid":10,"ev":true}]}',
      callback: callbackMock
    });
  }, 10000);

  afterAll(async () => {
    httpServer.closeAllConnections();
    httpServer.close();
  }, 30000);
});


async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



/* Normal Response
Event Register 0E:BA:1B:4F:CA:8D -> { characteristics: [ { aid: 5, iid: 10, ev: true } ] }

{
  protocol: 'HTTP',
  httpVersion: 1.1,
  statusCode: 204,
  statusMessage: 'No Content',
  method: null,
  url: null,
  headers: { Date: 'Fri, 29 Mar 2024 13:32:25 GMT', Connection: 'keep-alive' },
  body: null,
  boundary: null,
  multipart: null,
  additional: ''
}

*/