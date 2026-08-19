const BUILTIN_ORIGINS = new Set([
  'app://coiny',
  'capacitor://localhost',
  'https://localhost',
  'https://mandyfan10-stack.github.io'
]);

export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const configured = (Deno.env.get('ALLOWED_APP_ORIGINS') || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (configured.includes(origin) || BUILTIN_ORIGINS.has(origin)) return origin;
  try {
    const parsed = new URL(origin);
    if (['http:', 'https:'].includes(parsed.protocol) && ['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      return origin;
    }
  } catch {
    // Rejected by the caller.
  }
  return null;
}
