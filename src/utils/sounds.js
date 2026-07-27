let globalAudioCtx = null;

/**
 * Play a short UI sound (incoming / outgoing message).
 * @param {'incoming'|'outgoing'} [type='incoming']
 */
export function playSound(type = 'incoming') {
  try {
    if (!globalAudioCtx) {
      globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume();
    }
    const osc = globalAudioCtx.createOscillator();
    const gain = globalAudioCtx.createGain();

    if (type === 'incoming') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, globalAudioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(783.99, globalAudioCtx.currentTime + 0.07); // G5
      gain.gain.setValueAtTime(0, globalAudioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, globalAudioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, globalAudioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(globalAudioCtx.destination);
      osc.start();
      osc.stop(globalAudioCtx.currentTime + 0.25);
    } else {
      // outgoing
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, globalAudioCtx.currentTime); // E5
      gain.gain.setValueAtTime(0, globalAudioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, globalAudioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, globalAudioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(globalAudioCtx.destination);
      osc.start();
      osc.stop(globalAudioCtx.currentTime + 0.15);
    }
  } catch (e) {
    console.warn('AudioContext play failed', e);
  }
}
