const { RLP } = require('@ethersproject/rlp');

/**
 * Decodes an RLP-encoded storage value from Hyperbridge GET response.
 * @param {string|Buffer} rlpValue - The RLP-encoded value (hex string or Buffer).
 * @returns {string|number|BigInt} - The decoded value (as string, number, or BigInt).
 */
function decodeChainlinkRlpValue(rlpValue) {
  // RLP.decode returns a Buffer or array, depending on the encoding
  const decoded = RLP.decode(rlpValue);

  // For Chainlink price feeds, the value is usually a single int256 (as bytes)
  // Convert Buffer to BigInt (or string/number as needed)
  if (Buffer.isBuffer(decoded)) {
    // Remove leading zeros for positive numbers
    return BigInt('0x' + decoded.toString('hex'));
  }
  // If it's an array, handle accordingly (shouldn't be for a single storage slot)
  return decoded;
}

module.exports = { decodeChainlinkRlpValue }; 