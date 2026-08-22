import {
  PacketType,
  BINARY_MAGIC_BYTE,
  HEADER_SIZE,
} from '../types/live-room';
import {
  encodeBinaryPacket,
  decodeBinaryPacket,
  formatRoomIdTo36Bytes,
  parseRoomIdFrom36Bytes,
} from '../services/binaryProtocol';

function runTests() {
  console.log('--- Testando Protocolo Binário de 50 Bytes (0xAA) ---');

  // Test 1: Room ID formatting
  const rawRoomId = 'e4b1a2c3-1234-5678-abcd-ef0123456789';
  const formattedBytes = formatRoomIdTo36Bytes(rawRoomId);
  console.assert(formattedBytes.length === 36, 'Room ID formatted length must be 36');
  const parsedRoomId = parseRoomIdFrom36Bytes(formattedBytes, 0);
  console.assert(parsedRoomId === rawRoomId, 'Parsed room ID must match original');
  console.log('✓ Teste 1: Formatação e parsing de Room ID de 36 bytes OK');

  // Test 2: Video GPU Chunk (0x01) encoding and decoding
  const dummyVideoPayload = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x28]);
  const timestampUs = 123456789.5;
  const seqNum = 42;

  const videoPacket = encodeBinaryPacket({
    packetType: PacketType.VIDEO_GPU,
    roomId: rawRoomId,
    isKeyframe: true,
    timestampUs,
    sequenceNumber: seqNum,
    payload: dummyVideoPayload,
  });

  console.assert(
    videoPacket.byteLength === HEADER_SIZE + dummyVideoPayload.byteLength,
    `Packet length must be ${HEADER_SIZE + dummyVideoPayload.byteLength}`
  );

  const decodedVideo = decodeBinaryPacket(videoPacket);
  console.assert(decodedVideo !== null, 'Decoded packet must not be null');
  console.assert(decodedVideo!.magic === BINARY_MAGIC_BYTE, 'Magic byte must be 0xAA');
  console.assert(decodedVideo!.packetType === PacketType.VIDEO_GPU, 'PacketType must be 0x01');
  console.assert(decodedVideo!.roomId === rawRoomId, 'Room ID must match');
  console.assert(decodedVideo!.isKeyframe === true, 'Keyframe flag must be true');
  console.assert(Math.abs(decodedVideo!.timestampUs - timestampUs) < 0.001, 'Timestamp must match');
  console.assert(decodedVideo!.sequenceNumber === seqNum, 'Sequence number must match');
  console.assert(decodedVideo!.payload.length === dummyVideoPayload.length, 'Payload length must match');
  console.log('✓ Teste 2: Pacote de Vídeo GPU (0x01) codificado e decodificado com sucesso');

  // Test 3: Voice PCM Audio (0x05)
  const dummyVoicePCM = new Int16Array([500, -500, 1000, -1000, 2000, -2000]);
  const voicePacket = encodeBinaryPacket({
    packetType: PacketType.VOICE_AUDIO_PCM,
    roomId: rawRoomId,
    isKeyframe: false,
    timestampUs: 987654321,
    sequenceNumber: 100,
    payload: dummyVoicePCM.buffer,
  });

  const decodedVoice = decodeBinaryPacket(voicePacket);
  console.assert(decodedVoice!.packetType === PacketType.VOICE_AUDIO_PCM, 'PacketType must be 0x05');
  console.assert(decodedVoice!.isKeyframe === false, 'Keyframe must be false');
  console.assert(decodedVoice!.payload.byteLength === dummyVoicePCM.buffer.byteLength, 'PCM length match');
  console.log('✓ Teste 3: Pacote de Áudio de Microfone PCM (0x05) codificado e decodificado com sucesso');

  // Test 4: Screen Share Stereo PCM Audio (0x02)
  const dummyScreenAudioPCM = new Int16Array([100, 200, 300, 400]);
  const screenAudioPacket = encodeBinaryPacket({
    packetType: PacketType.SCREEN_AUDIO_PCM,
    roomId: rawRoomId,
    payload: dummyScreenAudioPCM.buffer,
  });
  const decodedScreenAudio = decodeBinaryPacket(screenAudioPacket);
  console.assert(decodedScreenAudio!.packetType === PacketType.SCREEN_AUDIO_PCM, 'PacketType must be 0x02');
  console.log('✓ Teste 4: Pacote de Áudio de Compartilhamento de Tela (0x02) codificado e decodificado com sucesso');

  // Test 5: Invalid packet rejection
  const invalidPacket = new ArrayBuffer(20); // less than 50 bytes
  console.assert(decodeBinaryPacket(invalidPacket) === null, 'Should reject buffer < 50 bytes');
  console.log('✓ Teste 5: Rejeição de pacotes com cabeçalho inválido/curto OK');

  console.log('\nTODOS OS TESTES DO PROTOCOLO BINÁRIO PASSARAM COM SUCESSO! 🎉');
}

runTests();
