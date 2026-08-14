import noiseGateWorkletUrl from './noiseGate.worklet.js?url';

export const CALL_AUDIO_CONSTRAINTS = Object.freeze({
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1
});

function peerConnections(primary, mesh) {
  return [primary, ...Object.values(mesh || {})].filter(Boolean);
}

export class VoiceEnhancementPipeline {
  constructor() {
    this.context = null;
    this.stream = null;
    this.originalTrack = null;
    this.processedTrack = null;
    this.nodes = [];
  }

  get active() {
    return Boolean(this.processedTrack);
  }

  async enable(stream, primaryPeer, meshPeers) {
    if (this.active) return;
    const originalTrack = stream?.getAudioTracks?.()[0];
    if (!originalTrack) throw new Error('Microphone track is unavailable.');

    const context = new AudioContext({ latencyHint: 'interactive' });
    try {
      if (context.state === 'suspended') {
        await context.resume();
      }
      await context.audioWorklet.addModule(noiseGateWorkletUrl);
      const source = context.createMediaStreamSource(new MediaStream([originalTrack]));
      const highPass = new BiquadFilterNode(context, { type: 'highpass', frequency: 80, Q: 0.707 });
      const compressor = new DynamicsCompressorNode(context, {
        threshold: -24,
        knee: 18,
        ratio: 3,
        attack: 0.003,
        release: 0.25
      });
      const gate = new AudioWorkletNode(context, 'coiny-noise-gate');
      const destination = context.createMediaStreamDestination();
      source.connect(highPass).connect(compressor).connect(gate).connect(destination);
      const processedTrack = destination.stream.getAudioTracks()[0];
      processedTrack.enabled = originalTrack.enabled;

      await Promise.all(peerConnections(primaryPeer, meshPeers).map(async (connection) => {
        const sender = connection.getSenders().find((candidate) => candidate.track?.kind === 'audio');
        if (sender) await sender.replaceTrack(processedTrack);
      }));
      stream.removeTrack(originalTrack);
      stream.addTrack(processedTrack);
      this.context = context;
      this.stream = stream;
      this.originalTrack = originalTrack;
      this.processedTrack = processedTrack;
      this.nodes = [source, highPass, compressor, gate, destination];
    } catch (error) {
      await context.close().catch(() => undefined);
      throw error;
    }
  }

  async disable(primaryPeer, meshPeers) {
    if (!this.active) return;
    const processedTrack = this.processedTrack;
    const originalTrack = this.originalTrack;
    originalTrack.enabled = processedTrack.enabled;
    await Promise.all(peerConnections(primaryPeer, meshPeers).map(async (connection) => {
      const sender = connection.getSenders().find((candidate) => candidate.track?.kind === 'audio');
      if (sender) await sender.replaceTrack(originalTrack);
    }));
    this.stream?.removeTrack(processedTrack);
    this.stream?.addTrack(originalTrack);
    processedTrack.stop();
    this.nodes.forEach((node) => node.disconnect?.());
    const context = this.context;
    this.context = null;
    this.stream = null;
    this.originalTrack = null;
    this.processedTrack = null;
    this.nodes = [];
    await context?.close().catch(() => undefined);
  }

  dispose(primaryPeer, meshPeers) {
    if (!this.active) return;
    const processedTrack = this.processedTrack;
    const originalTrack = this.originalTrack;
    originalTrack.enabled = processedTrack.enabled;
    peerConnections(primaryPeer, meshPeers).forEach((connection) => {
      const sender = connection.getSenders().find((candidate) => candidate.track?.kind === 'audio');
      if (sender) void sender.replaceTrack(originalTrack);
    });
    this.stream?.removeTrack(processedTrack);
    this.stream?.addTrack(originalTrack);
    processedTrack.stop();
    this.nodes.forEach((node) => node.disconnect?.());
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.stream = null;
    this.originalTrack = null;
    this.processedTrack = null;
    this.nodes = [];
  }
}
