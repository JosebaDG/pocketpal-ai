const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/** Strict base64 decoder: no whitespace tolerance beyond line breaks, bounded output. */
export function base64ToBytes(
  input: string,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Uint8Array {
  const clean = input.replace(/[\r\n]/g, '');
  if (clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    throw new Error('Invalid base64 data');
  }
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const size = (clean.length / 4) * 3 - padding;
  if (size > maxBytes) {
    throw new Error('File exceeds size limit');
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const values = [0, 1, 2, 3].map(step => {
      const char = clean[index + step];
      return char === '=' ? 0 : ALPHABET.indexOf(char);
    });
    const triple =
      values[0] * 262144 + values[1] * 4096 + values[2] * 64 + values[3];
    const bytes = [
      Math.floor(triple / 65536) % 256,
      Math.floor(triple / 256) % 256,
      triple % 256,
    ];
    for (const byte of bytes) {
      if (offset < size) {
        out[offset] = byte;
        offset += 1;
      }
    }
  }
  return out;
}
