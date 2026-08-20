export type RecordingMode = 'voice' | 'video';

const MIME_CANDIDATES: Record<RecordingMode, readonly string[]> = {
  voice: [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ],
  video: [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
  ],
};

export function getRecordingMimeCandidates(mode: RecordingMode): readonly string[] {
  return MIME_CANDIDATES[mode];
}

export function getSupportedRecordingMimeTypes(
  mode: RecordingMode,
  recorderClass: { isTypeSupported?: (mimeType: string) => boolean },
): string[] {
  const candidates = [...getRecordingMimeCandidates(mode)];
  if (typeof recorderClass?.isTypeSupported !== 'function') return candidates;
  return candidates.filter((mimeType) => recorderClass.isTypeSupported?.(mimeType));
}

export function normalizeRecordingMimeType(
  mimeType: string | null | undefined,
  mode: RecordingMode,
): string {
  const normalized = String(mimeType || '').toLowerCase().split(';')[0].trim();
  const expectedPrefix = mode === 'voice' ? 'audio/' : 'video/';
  if (normalized.startsWith(expectedPrefix)) return normalized;
  return mode === 'voice' ? 'audio/webm' : 'video/webm';
}
