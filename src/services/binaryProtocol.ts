import {
  BINARY_MAGIC_BYTE,
  HEADER_SIZE,
  PacketType,
  BinaryHeader,
} from '../types/live-room';

/**
 * Formats or pads a Room ID string into a 36-byte ASCII Uint8Array.
 * If the string is shorter than 36 characters, pads with spaces (0x20).
 * If longer, truncates to 36 characters.
 */
export function formatRoomIdTo36Bytes(roomId: string): Uint8Array {
  const bytes = new Uint8Array(36);
  const normalized = (roomId || '').padEnd(36, ' ').slice(0, 36);
  for (let i = 0; i < 36; i++) {
    bytes[i] = normalized.charCodeAt(i) & 0x7F;
  }
  return bytes;
}

/**
 * Decodes 36 bytes of ASCII into a clean, trimmed string.
 */
export function parseRoomIdFrom36Bytes(bytes: Uint8Array, offset = 2): string {
  let str = '';
  for (let i = 0; i < 36; i++) {
    const code = bytes[offset + i];
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str.trim();
}

/**
 * Encodes a 50-byte header + payload into a single ArrayBuffer.
 */
export function encodeBinaryPacket(options: {
  packetType: PacketType;
  roomId: string;
  isKeyframe?: boolean;
  timestampUs?: number;
  sequenceNumber?: number;
  payload: Uint8Array | ArrayBuffer;
}): ArrayBuffer {
  const payloadBytes =
    options.payload instanceof Uint8Array
      ? options.payload
      : new Uint8Array(options.payload);

  const totalLength = HEADER_SIZE + payloadBytes.byteLength;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  // 0x00: Magic Byte (0xAA)
  uint8View[0] = BINARY_MAGIC_BYTE;

  // 0x01: Packet Type
  uint8View[1] = options.packetType;

  // 0x02..0x25 (36 Bytes): Room ID ASCII
  const roomIdBytes = formatRoomIdTo36Bytes(options.roomId);
  uint8View.set(roomIdBytes, 2);

  // 0x26 (Byte 38): Keyframe Flag (1 = Keyframe, 0 = Delta)
  uint8View[38] = options.isKeyframe ? 1 : 0;

  // 0x27..0x2E (8 Bytes, Offset 39): Float64 Timestamp in µs
  const ts = options.timestampUs ?? performance.now() * 1000;
  view.setFloat64(39, ts, false); // Big-Endian by network standard

  // 0x2F..0x31 (3 Bytes, Offset 47, 48, 49): Sequence number (24-bit uint)
  const seq = (options.sequenceNumber ?? 0) & 0xFFFFFF;
  uint8View[47] = (seq >> 16) & 0xFF;
  uint8View[48] = (seq >> 8) & 0xFF;
  uint8View[49] = seq & 0xFF;

  // 0x32 (Offset 50)..End: Raw Payload
  uint8View.set(payloadBytes, HEADER_SIZE);

  return buffer;
}

/**
 * Validates and decodes an incoming ArrayBuffer into BinaryHeader struct.
 * Returns null if magic byte is invalid or length < 50.
 */
export function decodeBinaryPacket(buffer: ArrayBuffer): BinaryHeader | null {
  if (!buffer || buffer.byteLength < HEADER_SIZE) {
    return null;
  }

  const uint8View = new Uint8Array(buffer);

  // Check 0xAA Magic Byte
  if (uint8View[0] !== BINARY_MAGIC_BYTE) {
    return null;
  }

  const packetType = uint8View[1] as PacketType;
  const roomId = parseRoomIdFrom36Bytes(uint8View, 2);
  const isKeyframe = uint8View[38] === 1;

  const view = new DataView(buffer);
  const timestampUs = view.getFloat64(39, false);

  const seq = (uint8View[47] << 16) | (uint8View[48] << 8) | uint8View[49];
  const payload = uint8View.slice(HEADER_SIZE);

  return {
    magic: BINARY_MAGIC_BYTE,
    packetType,
    roomId,
    isKeyframe,
    timestampUs,
    sequenceNumber: seq,
    payload,
  };
}
