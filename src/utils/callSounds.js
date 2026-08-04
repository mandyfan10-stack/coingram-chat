/**
 * Synthetic call ringtones / connect-disconnect cues (Web Audio).
 */

function createCtx() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

/** Short tone when WebRTC becomes connected. */
export function playCallConnect() {
  try {
    const audioCtx = createCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {
    /* ignore */
  }
}

/** Short tone when call ends. */
export function playCallDisconnect() {
  try {
    const audioCtx = createCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc.frequency.setValueAtTime(240, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
  } catch {
    /* ignore */
  }
}

/**
 * Outgoing ringback loop.
 * @returns {{ stop: () => void }}
 */
export function startCallRingback() {
  try {
    const audioCtx = createCtx();
    const playBeep = () => {
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(425, audioCtx.currentTime);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime + 0.95);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.05);
      } catch {
        /* ignore */
      }
    };
    playBeep();
    const ringInterval = setInterval(playBeep, 3000);
    return {
      stop: () => {
        clearInterval(ringInterval);
        try {
          audioCtx.close();
        } catch {
          /* ignore */
        }
      }
    };
  } catch {
    return { stop: () => {} };
  }
}

/**
 * Incoming ringtone loop.
 * @returns {{ stop: () => void }}
 */
export function startIncomingRingtone() {
  try {
    const audioCtx = createCtx();
    const playBeep = () => {
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      } catch {
        /* ignore */
      }
    };
    playBeep();
    const ringInterval = setInterval(playBeep, 2000);
    return {
      stop: () => {
        clearInterval(ringInterval);
        try {
          audioCtx.close();
        } catch {
          /* ignore */
        }
      }
    };
  } catch {
    return { stop: () => {} };
  }
}
