import { supabase } from '../../supabaseClient.js';

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

function isTurnUrl(value: unknown): value is string {
  return typeof value === 'string' && /^turns?:[^\s]+$/i.test(value);
}

function normalizeFetchedIceServers(payload: unknown): RTCIceServer[] {
  if (!payload || typeof payload !== 'object') return [];
  const iceServers = (payload as { iceServers?: unknown }).iceServers;
  if (!Array.isArray(iceServers)) return [];

  const servers: RTCIceServer[] = [];
  for (const entry of iceServers) {
    if (!entry || typeof entry !== 'object') continue;
    const urlsValue = (entry as { urls?: unknown }).urls;
    const urls = Array.isArray(urlsValue) ? urlsValue.filter(isTurnUrl) : (isTurnUrl(urlsValue) ? [urlsValue] : []);
    if (!urls.length) continue;
    const username = (entry as { username?: unknown }).username;
    const secret = (entry as { credential?: unknown }).credential;
    if (typeof username !== 'string' || typeof secret !== 'string' || !username || !secret) continue;
    servers.push({ urls, username, credential: secret });
  }
  return servers;
}

function configurationFor(
  options: IceConfigProviderOptions,
  extraServers: RTCIceServer[] = []
): RTCConfiguration {
  const hasRelay = extraServers.length > 0;
  return {
    iceServers: hasRelay ? [...STUN_SERVERS, ...extraServers] : STUN_SERVERS,
    iceTransportPolicy: hasRelay && !options.allowDirectConnection ? 'relay' : 'all'
  };
}

export async function refreshIceConfiguration(options: IceConfigProviderOptions = {}): Promise<RTCConfiguration> {
  let relayServers: RTCIceServer[] = [];
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('turn-credentials', { method: 'POST' });
      if (!error && data?.available) {
        relayServers = normalizeFetchedIceServers(data);
      }
    } catch {
      relayServers = [];
    }
  }

  cachedConfiguration = configurationFor(options, relayServers);
  return cachedConfiguration;
}

export function getIceConfiguration(): RTCConfiguration {
  return cachedConfiguration;
}

export const ICE_SERVERS = STUN_SERVERS;

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(getIceConfiguration());
}
