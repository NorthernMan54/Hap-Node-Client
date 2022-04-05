var uuid = require('./uuid.js');
var descriptions = require('./hap-types.js').Characteristics;

function normalizeUUID(message) {
  // Thanks Oznu
  try {
    let input = JSON.parse(JSON.stringify(message).replace(/\uFFFD/g, ''));
    input.accessories.forEach((accessory) => {
      /** Ensure UUIDs are long form */
      for (const service of accessory.services) {
        service.type = uuid.toLongFormUUID(service.type);
        for (const characteristic of service.characteristics) {
          characteristic.type = uuid.toLongFormUUID(characteristic.type);
          if (descriptions[characteristic.type]) {
            characteristic.description = descriptions[characteristic.type];
          }
        }
      }
    });
    return input;
  } catch (err) {
    console.log('normalizeUUID', err.message);
    return message;
  }
}

exports.normalizeUUID = normalizeUUID;
