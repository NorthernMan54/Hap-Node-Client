// Monkey patch before you require http for the first time.
const parser = require('./httpParser.js');
var once = require('once');
var URL = require('url');
var debug = require('debug')('hapHttpClient');
const net = require('net');
var Queue = require('better-queue');

module.exports = eventedHttpClient;

function eventedHttpClient(request) {
  //
  // Queue requests to a single homebridge instance
  //
  this.q = new Queue(function(request, cb) {
    processRequest.call(request.context, request.request, cb);
  }, {
    concurrent: 1,
    autoResume: true
  });

  this.context = URL.parse(request.url);
  var buffer = [];
  this.url = request.url;
  this.connected = false;
  this.chunked = false;
  this.reconnect = request['reconnect'] || false;
  this.callback = once(request.callback);
  this.client = net.createConnection({
    host: this.context.hostname,
    port: this.context.port
  }, () => {
    this.connected = true;
    this.client.write(_buildMessage(request));
  });

  this.client.on('data', (data) => {
    // If in the middle of a chunked response
    // debug("Data", this.url, data.toString());
    // debug("Chunked", this.chunked);
    var response;
    if (this.chunked) {
      // debug("final ?", data.slice(-7));
      if (data.slice(-5).toString() !== '0\r\n\r\n') {
        // console.log("Chunked");
        buffer.push(data);
      } else {
        // Last chunked message
        this.chunked = false;
        buffer.push(data);
        response = parser(Buffer.concat(buffer));
        buffer = [];
        // debug("Callback-1", response.body);
        this.callback(null, response);
      }
    } else {
      // Handle regular messages
      response = parser(data);
      // debug("res", data.toString());
      if (response.headers && response.headers['Transfer-Encoding'] && response.headers['Transfer-Encoding'].toLowerCase() === 'chunked' && data.slice(-7).toString() !== '\r\n0\r\n\r\n') {
        this.chunked = true;
        buffer.push(data);
      } else {
        if (response.protocol === 'EVENT') {
          if (response.additional.length > 5) {
            // pass remaining buffer data back thru
            this.client.emit('data', response.additional);
          }
          _sendHapEvent(request, response, this.context);
        } else {
          this.callback(null, response);
          // debug("Callback-2", response.body);
        }
      }
    }
  });

  this.client.on('error', (err) => {
    this.connected = false;
    console.log('Error: from server', this.context.host, err);
    if (!this.callback.called) {
      this.callback(new Error("Error:", err));
    }
  });

  this.client.on('end', () => {
    this.connected = false;
    debug('Disconnected from server', this.context.host, request.deviceID);
    if (request.eventBus) {
      request.eventBus.emit('Disconnected', { server: this.context.host, deviceID: request.deviceID });
    }
  });
}

function _sendHapEvent(request, response) {
  // Event messages are never the result of a callback
  var context = URL.parse(request.url);
  response.url = 'http://' + context.hostname + ':' + context.port + '/';
  if (request.eventBus) {
    // debug("EVENT", request);
    var url = URL.parse(response.url);
    var message = JSON.parse(response.body);
    if (message.characteristics) {
      var events = [];
      message.characteristics.forEach(function(key, element) {
        // debug("char", key, element);
        var event = {
          'host': url.hostname,
          'port': parseInt(url.port),
          'deviceID': request.deviceID,
          'aid': key.aid,
          'iid': key.iid,
          'value': key.value,
          'status': key.value
        };
        events.push(event);
      });
      request.eventBus.emit('Event', events);
    } else {
      debug("Incomplete EVENT", url, message);
    }
  }
}

function _headersToString(headers) {
  var response = "";

  for (var header in headers) {
    response = response + header + ': ' + headers[header] + '\r\n';
  }
  return (response);
}

function processRequest(request, cb) {
  this.callback = cb;
  this.client.write(_buildMessage(request));
}

eventedHttpClient.prototype.request = function(request) {
  // debug("QRequest", request);
  this.q.push({
    request: request,
    context: this
  }, once(request.callback));
};

function _buildMessage(request) {
  var context = URL.parse(request.url);
  var message;

  message = request.method + ' ' + context.pathname;
  if (context.search) {
    message = message + context.search;
  }
  message = message + ' HTTP/1.1\r\nHost: ' + context.host + '\r\n' + _headersToString(request.headers);
  if (request.body) {
    message = message + 'Content-Length: ' + request.body.length + '\r\n\r\n' + request.body + '\r\n\r\n';
  } else {
    message = message + '\r\n\r\n';
  }
  // debug("Message ->", message);
  return (message);
}
