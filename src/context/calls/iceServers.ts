import { supabase } from '../../supabaseClient.js';

export interface IceConfigProviderOptions {
  allowDirectConnection?: boolean;
}

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

let cachedConfiguration: RTCConfiguration = { iceServers: STUN_SERVERS, iceTransportPolicy: 'all' };
let cachedTurnServers: RTCIceServer[] | null = null;
let expiresAt = 0;

function configurationFor(options: IceConfigProviderOptions): RTCConfiguration {
  if (!cachedTurnServers) return { iceServers: STUN_SERVERS, iceTransportPolicy: 'all' };
  return {
    iceServers: options.allowDirectConnection
      ? [...STUN_SERVERS, ...cachedTurnServers]
      : cachedTurnServers,
    iceTransportPolicy: options.allowDirectConnection ? 'all' : 'relay'
  };
}

export async function refreshIceConfiguration(options: IceConfigProviderOptions = {}): Promise<RTCConfiguration> {
  if (!supabase) return configurationFor(options);
  if (Date.now() < expiresAt - 30_000) {
    cachedConfiguration = configurationFor(options);
    return cachedConfiguration;
  }
  try {
    const { data, error } = await supabase.functions.invoke('turn-credentials');
    if (error || !data?.available || !Array.isArray(data.iceServers)) {
      cachedTurnServers = null;
      cachedConfiguration = configurationFor(options);
      expiresAt = Date.now() + 60_000;
      return cachedConfiguration;
    }
    cachedTurnServers = data.iceServers;
    cachedConfiguration = configurationFor(options);
    expiresAt = Number(data.expiresAt) || Date.now() + 5 * 60_000;
  } catch {
    cachedTurnServers = null;
    cachedConfiguration = configurationFor(options);
    expiresAt = Date.now() + 60_000;
  }
  return cachedConfiguration;
}

export function getIceConfiguration(): RTCConfiguration {
  return cachedConfiguration;
}

export const ICE_SERVERS = STUN_SERVERS;

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(getIceConfiguration());
}
