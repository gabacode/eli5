export interface AudioAnalyzerInterface {
  getAnalyzerNode(): AnalyserNode;
  connectSource(source: AudioNode): void;
  getAverageFrequency(): number;
  cleanup(): void;
  dataArray: Uint8Array;
}

export class AudioAnalyzer implements AudioAnalyzerInterface {
  private analyzer: AnalyserNode;
  public dataArray: Uint8Array;
  public amplitude: number;

  constructor(context: AudioContext) {
    this.analyzer = context.createAnalyser();
    this.analyzer.fftSize = 64;
    this.analyzer.minDecibels = -90;
    this.analyzer.maxDecibels = -10;
    this.analyzer.smoothingTimeConstant = 0.65;
    this.amplitude = 0;
    this.dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
  }

  getFrequencyData(dataArray: Uint8Array): void {
    return this.analyzer.getByteFrequencyData(dataArray);
  }

  getAnalyzerNode(): AnalyserNode {
    return this.analyzer;
  }

  connectSource(source: AudioNode): void {
    source.connect(this.analyzer);
    console.log("Audio source connected to analyzer", {
      fftSize: this.analyzer.fftSize,
      frequencyBinCount: this.analyzer.frequencyBinCount,
      minDecibels: this.analyzer.minDecibels,
      maxDecibels: this.analyzer.maxDecibels,
    });
  }

  getAverageFrequency(): number {
    this.analyzer.getByteFrequencyData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    return sum / this.dataArray.length / 255;
  }

  cleanup(): void {
    try {
      this.analyzer.disconnect();
    } catch (error) {
      console.error("Error cleaning up analyzer:", error);
    }
  }
}
