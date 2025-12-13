declare module 'node-vad' {
  export enum Mode {
    NORMAL = 0,
    LOW_BITRATE = 1,
    AGGRESSIVE = 2,
    VERY_AGGRESSIVE = 3
  }

  export class VAD {
    static Mode: any;
    constructor(mode: Mode);
    processAudio(buffer: Buffer | Float32Array, sampleRate: number): Promise<{ voice: boolean }>;
  }

  export default VAD;
}
