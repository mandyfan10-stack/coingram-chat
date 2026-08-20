class CoinyNoiseGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.gain = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input?.length || !output?.length) return true;
    let sum = 0;
    let samples = 0;
    for (const channel of input) {
      for (const sample of channel) {
        sum += sample * sample;
        samples += 1;
      }
    }
    const rms = Math.sqrt(sum / Math.max(samples, 1));
    const target = rms >= 0.007 ? 1 : 0;
    const smoothing = target > this.gain ? 0.25 : 0.04;
    this.gain += (target - this.gain) * smoothing;
    for (let channelIndex = 0; channelIndex < output.length; channelIndex += 1) {
      const source = input[channelIndex] || input[0];
      const destination = output[channelIndex];
      for (let index = 0; index < destination.length; index += 1) {
        destination[index] = (source?.[index] || 0) * this.gain;
      }
    }
    return true;
  }
}

registerProcessor('coiny-noise-gate', CoinyNoiseGateProcessor);
