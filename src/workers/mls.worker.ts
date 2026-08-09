type WorkerRequest = { id: string; operation: string; payload: Record<string, unknown> };

let runtime: Record<string, (...args: unknown[]) => unknown> | null = null;

async function initialize(moduleUrl: string): Promise<void> {
  const module = await import(/* @vite-ignore */ moduleUrl);
  if (typeof module.default === 'function') await module.default();
  runtime = module;
}

async function execute(operation: string, payload: Record<string, unknown>): Promise<unknown> {
  if (operation === 'initialize') {
    await initialize(String(payload.moduleUrl || '/openmls/openmls_wasm.js'));
    return { ready: true };
  }
  if (!runtime) throw new Error('Pinned OpenMLS WASM runtime is unavailable. E2EE v2 remains fail-closed.');
  const handler = runtime[operation];
  if (typeof handler !== 'function') throw new Error(`Unsupported MLS worker operation: ${operation}`);
  return handler(payload);
}

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    const result = await execute(data.operation, data.payload);
    self.postMessage({ id: data.id, result });
  } catch (error) {
    self.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : 'MLS worker operation failed'
    });
  }
};
