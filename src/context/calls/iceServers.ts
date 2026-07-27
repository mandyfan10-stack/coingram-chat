/** Shared STUN/TURN config for 1:1 and group peer connections. */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  {
    urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
    username: 'openrelay',
    credential: 'openrelay'
  }
];

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}
