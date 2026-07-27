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
    audioEl.className = 'webrtc-remote-audio-feed';
    document.body.appendChild(audioEl);
  }
  audioEl.srcObject = remoteStream;
  audioEl.play().catch((e) => {
    console.warn('Audio element autoplay failed:', e);
  });
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
