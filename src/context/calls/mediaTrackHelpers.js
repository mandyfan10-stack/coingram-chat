/** @param {MediaStreamTrack} track */
export function isScreenTrack(track) {
  const label = track.label ? track.label.toLowerCase() : '';
  return label.includes('screen')
    || label.includes('window')
    || label.includes('display')
    || label.includes('desktop');
}

/** Attach remote audio stream to a hidden autoplay element. */
export function attachRemoteAudioElement(elementId, remoteStream) {
  let audioEl = document.getElementById(elementId);
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = elementId;
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.volume = 1.0;
    audioEl.muted = false;
    audioEl.className = 'webrtc-remote-audio-feed';
    document.body.appendChild(audioEl);
  }
  audioEl.muted = false;
  audioEl.volume = 1.0;
  audioEl.srcObject = remoteStream;
  const playPromise = audioEl.play();
  if (playPromise !== undefined) {
    playPromise.catch((e) => {
      console.warn('Audio element autoplay failed, attaching user interaction unlocker:', e);
      const unlockAudio = () => {
        audioEl.play().catch(() => {});
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { once: true });
      window.addEventListener('touchstart', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
    });
  }
  return audioEl;
}

/** @param {RTCPeerConnection} pcInstance */
export function removeVideoSender(pcInstance) {
  const senders = pcInstance.getSenders();
  const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
  if (videoSender) pcInstance.removeTrack(videoSender);
}

/**
 * Replace existing video sender track or add a new one.
 * @param {RTCPeerConnection} pcInstance
 * @param {MediaStreamTrack} videoTrack
 * @param {MediaStream} stream
 */
export async function replaceOrAddVideoTrack(pcInstance, videoTrack, stream) {
  const senders = pcInstance.getSenders();
  const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
  if (videoSender) {
    await videoSender.replaceTrack(videoTrack);
  } else {
    pcInstance.addTrack(videoTrack, stream);
  }
}

/** Stop all tracks on a stream if present. */
export function stopStreamTracks(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
