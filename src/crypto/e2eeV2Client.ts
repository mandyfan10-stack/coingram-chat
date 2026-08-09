import { requireE2EEV2Enabled } from '../config/e2eeV2';
import {
  commitConversationCryptoTransition,
  commitConversationDecryptTransition,
  loadConversationCryptoState
} from '../utils/indexedDbHelper.js';
import type { CryptoEnvelopeV2, EncryptedEventType } from '../types/e2eeV2';

type WorkerResponse = { id: string; result?: unknown; error?: string };

class E2EEV2Client {
  private worker: Worker | null = null;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private chatOperations = new Map<string, Promise<unknown>>();

  private getWorker(): Worker {
    requireE2EEV2Enabled();
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/mls.worker.ts', import.meta.url), { type: 'module', name: 'coiny-mls' });
      this.worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        const pending = this.pending.get(data.id);
        if (!pending) return;
        this.pending.delete(data.id);
        if (data.error) pending.reject(new Error(data.error));
        else pending.resolve(data.result);
      };
      this.worker.onerror = () => {
        for (const pending of this.pending.values()) pending.reject(new Error('MLS worker crashed.'));
        this.pending.clear();
        this.worker?.terminate();
        this.worker = null;
      };
    }
    return this.worker;
  }

  private request(operation: string, payload: Record<string, unknown>): Promise<unknown> {
    const id = crypto.randomUUID();
    const worker = this.getWorker();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, operation, payload });
    });
  }

  private serialize<T>(chatId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.chatOperations.get(chatId) || Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.chatOperations.set(chatId, current);
    return current.finally(() => {
      if (this.chatOperations.get(chatId) === current) this.chatOperations.delete(chatId);
    });
  }

  initialize(moduleUrl = '/openmls/openmls_wasm.js'): Promise<unknown> {
    return this.request('initialize', { moduleUrl });
  }

  encryptEvent(userId: string, deviceId: string, chatId: string, eventType: EncryptedEventType, payload: unknown): Promise<CryptoEnvelopeV2> {
    return this.serialize(chatId, async () => {
      const state = await loadConversationCryptoState(userId, chatId);
      if (!state) throw new Error('MLS conversation state is unavailable.');
      const transition = await this.request('encrypt_event', { state, chatId, deviceId, eventType, payload }) as {
        state: unknown;
        envelope: CryptoEnvelopeV2;
      };
      await commitConversationCryptoTransition(userId, chatId, transition.state, {
        id: crypto.randomUUID(),
        chatId,
        senderDeviceId: deviceId,
        cryptoVersion: 2,
        encryptedPayload: transition.envelope.encryptedPayload
      });
      return transition.envelope;
    });
  }

  decryptEvent(userId: string, chatId: string, envelope: CryptoEnvelopeV2): Promise<unknown> {
    return this.serialize(chatId, async () => {
      const state = await loadConversationCryptoState(userId, chatId);
      if (!state) throw new Error('MLS conversation state is unavailable.');
      const transition = await this.request('decrypt_event', { state, envelope }) as {
        state: unknown;
        payload: unknown;
        receiptId?: string;
      };
      if (!transition || !Object.hasOwn(transition, 'state')) {
        throw new Error('MLS runtime returned an invalid receive-state transition.');
      }
      await commitConversationDecryptTransition(userId, chatId, transition.state, {
        id: transition.receiptId || envelope.payloadHash,
        chatId,
        senderDeviceId: envelope.senderDeviceId,
        epoch: envelope.epoch,
        payloadHash: envelope.payloadHash
      });
      return transition.payload;
    });
  }

  call(operation: string, payload: Record<string, unknown>): Promise<unknown> {
    return this.request(operation, payload);
  }
}

export const e2eeV2Client = new E2EEV2Client();
