import {base64ToBytes} from '../base64Bytes';

describe('strict base64 decoding', () => {
  it('matches Buffer for every padding case', () => {
    for (let length = 0; length <= 7; length += 1) {
      const source = Uint8Array.from({length}, (_, i) => (i * 73 + 200) % 256);
      const encoded = Buffer.from(source).toString('base64');
      expect(Array.from(base64ToBytes(encoded))).toEqual(Array.from(source));
    }
  });

  it('rejects invalid characters, wrong length and misplaced padding', () => {
    expect(() => base64ToBytes('AB*D')).toThrow('Invalid base64');
    expect(() => base64ToBytes('ABC')).toThrow('Invalid base64');
    expect(() => base64ToBytes('A=BC')).toThrow('Invalid base64');
  });

  it('enforces the output limit before allocating', () => {
    const encoded = Buffer.from(new Uint8Array(100)).toString('base64');
    expect(() => base64ToBytes(encoded, 99)).toThrow('size limit');
    expect(base64ToBytes(encoded, 100)).toHaveLength(100);
  });
});
