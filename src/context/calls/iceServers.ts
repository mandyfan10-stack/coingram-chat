export interface IceConfigProviderOptions {
  allowDirectConnection?: boolean;
}

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

let cachedConfiguration: RTCConfiguration = { iceServers: STUN_SERVERS, iceTransportPolicy: 'all' };

function configurationFor(options: IceConfigProviderOptions): RTCConfiguration {
  return {
    iceServers: STUN_SERVERS,
    iceTransportPolicy: options.allowDirectConnection ? 'all' : 'relay'
  };
}

export async function refreshIceConfiguration(options: IceConfigProviderOptions = {}): Promise<RTCConfiguration> {
  // TURN is unavailable / not configured; pure STUN mesh is used.
  cachedConfiguration = configurationFor(options);
  return cachedConfiguration;
}

export function getIceConfiguration(): RTCConfiguration {
  return cachedConfiguration;
}

export const ICE_SERVERS = STUN_SERVERS;

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(getIceConfiguration());
}

