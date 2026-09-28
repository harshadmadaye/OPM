'use strict';
// Minimal PNG header reader: pulls width/height out of the IHDR chunk without
// depending on any image library.

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngSize(buffer) {
  const isPng =
    buffer.length >= 24 &&
    buffer.subarray(0, 8).equals(SIGNATURE) &&
    buffer.toString('ascii', 12, 16) === 'IHDR';
  if (!isPng) {
    throw new Error('not a PNG');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

module.exports = { readPngSize };
