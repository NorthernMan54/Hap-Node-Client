var uuid = require('./uuid.js');

function normalizeUUID(input) {
  // Thanks Oznu
  input.accessories.forEach((accessory) => {
    /** Ensure UUIDs are long form */
    for (const service of accessory.services) {
      service.type = uuid.toLongFormUUID(service.type);
      for (const characteristic of service.characteristics) {
        characteristic.type = uuid.toLongFormUUID(characteristic.type);
      }
    }
  });
  return input;
}

exports.normalizeUUID = normalizeUUID;
