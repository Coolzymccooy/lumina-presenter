function extractConsoleMessageText(detailsOrEvent, level, message) {
  if (typeof message === 'string') return message;
  if (typeof level === 'string') return level;
  if (detailsOrEvent && typeof detailsOrEvent === 'object' && typeof detailsOrEvent.message === 'string') {
    return detailsOrEvent.message;
  }
  return '';
}

function normalizeAudioPcmPayload(pcm) {
  if (Buffer.isBuffer(pcm)) return pcm;
  if (pcm instanceof ArrayBuffer) return Buffer.from(pcm);
  if (ArrayBuffer.isView(pcm)) {
    return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  }
  return null;
}

function describePayloadType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Buffer.isBuffer(value)) return 'Buffer';
  if (ArrayBuffer.isView(value)) return value.constructor?.name || 'ArrayBufferView';
  if (value instanceof ArrayBuffer) return 'ArrayBuffer';
  if (typeof value === 'object') return value.constructor?.name || 'object';
  return typeof value;
}

module.exports = {
  describePayloadType,
  extractConsoleMessageText,
  normalizeAudioPcmPayload,
};
