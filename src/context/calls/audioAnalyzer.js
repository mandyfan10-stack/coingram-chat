/**
 * Lightweight speaking-indicator from a MediaStream.
 * @param {MediaStream} stream
 * @param {(isSpeaking: boolean) => void} onVolume
 * @returns {{ stop: () => void } | null}
 */
export function startAudioAnalyzer(stream, onVolume) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    const audioCtx = new AudioContextClass();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let isStopped = false;
    const checkVolume = () => {
      if (isStopped) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const isSpeaking = average > 15;
      onVolume(isSpeaking);

      setTimeout(() => {
        if (!isStopped) requestAnimationFrame(checkVolume);
      }, 50);
    };
    checkVolume();

    return {
      stop: () => {
        isStopped = true;
        try {
          source.disconnect();
          analyser.disconnect();
          audioCtx.close();
        } catch {
          /* ignore */
        }
      }
    };
  } catch (e) {
    console.warn('Failed to create audio analyzer:', e);
    return null;
  }
}
