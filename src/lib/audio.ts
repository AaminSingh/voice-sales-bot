/**
 * Converts raw PCM audio buffer to a valid WAV (RIFF) buffer by prepending a 44-byte WAV header.
 *
 * @param pcmData Raw PCM audio samples (little-endian)
 * @param sampleRate Sampling rate in Hz (default 24000)
 * @param channels Number of audio channels (default 1 for mono)
 * @param bitsPerSample Bit depth per sample (default 16)
 * @returns Buffer containing the complete WAV file bytes
 */
export function pcmToWav(
  pcmData: Buffer | Uint8Array,
  sampleRate: number = 24000,
  channels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4); // ChunkSize = 36 + SubChunk2Size
  header.write("WAVE", 8);

  // "fmt " sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size = 16 for PCM
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (linear PCM)
  header.writeUInt16LE(channels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(byteRate, 28); // ByteRate
  header.writeUInt16LE(blockAlign, 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample

  // "data" sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40); // Subchunk2Size

  const pcmBuffer = Buffer.isBuffer(pcmData) ? pcmData : Buffer.from(pcmData);
  return Buffer.concat([header, pcmBuffer]);
}
