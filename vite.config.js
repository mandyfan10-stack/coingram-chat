import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
function trustedOrigin(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.origin : null
  } catch {
    return null
  }
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const e2eeV2Enabled = environment.VITE_E2EE_V2_ENABLED === 'true'
  const e2eeV2AuditApproved = environment.VITE_E2EE_V2_AUDIT_APPROVED === 'true'
  if (e2eeV2AuditApproved && !e2eeV2Enabled) {
    throw new Error('E2EE v2 cannot be marked audit-approved while its feature flag is disabled.')
  }
  if (e2eeV2Enabled) {
    const requiredArtifacts = [
      'crypto/openmls-wasm/Cargo.lock',
      'public/openmls/openmls_wasm.js',
      'public/openmls/openmls_wasm_bg.wasm'
    ].map((file) => resolve(process.cwd(), file))
    const missingArtifact = requiredArtifacts.find((file) => !existsSync(file))
    if (missingArtifact) throw new Error(`E2EE v2 is fail-closed: required OpenMLS artifact is missing: ${missingArtifact}`)

    const expectedWasmHash = String(environment.OPENMLS_WASM_SHA256 || '').toLowerCase()
    const actualWasmHash = createHash('sha256').update(readFileSync(requiredArtifacts[2])).digest('hex')
    if (!/^[0-9a-f]{64}$/.test(expectedWasmHash) || actualWasmHash !== expectedWasmHash) {
      throw new Error('E2EE v2 is fail-closed: OPENMLS_WASM_SHA256 does not match the pinned WASM artifact.')
    }
    if (e2eeV2AuditApproved && !/^[0-9a-f]{64}$/i.test(environment.E2EE_V2_AUDIT_REPORT_SHA256 || '')) {
      throw new Error('Audited E2EE v2 builds require E2EE_V2_AUDIT_REPORT_SHA256.')
    }
  }
  const supabaseOrigin = trustedOrigin(environment.VITE_SUPABASE_URL)
  const supabaseSocketOrigin = supabaseOrigin ? supabaseOrigin.replace(/^https:/, 'wss:') : null
  const isDev = mode === 'development' || mode === 'mock' || !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
  const developmentSources = isDev ? ['http://localhost:*', 'ws://localhost:*'] : []
  const remoteSources = [supabaseOrigin, supabaseSocketOrigin].filter(Boolean)
  const gifDomains = ['https://*.giphy.com', 'https://*.tenor.com', 'https://media.giphy.com', 'https://media.tenor.com', 'https://c.tenor.com', 'https://tenor.googleapis.com', 'https://img.icons8.com']
  const connectSources = ["'self'", ...remoteSources, 'https://api.github.com', 'https://api.giphy.com', 'https://tenor.googleapis.com', ...gifDomains, ...developmentSources].join(' ')
  const mediaSources = ["'self'", 'data:', 'blob:', supabaseOrigin, ...gifDomains].filter(Boolean).join(' ')
  // Vite injects the React Refresh preamble as an inline module in development.
  // Keep production strict while allowing the dev-only preamble to execute.
  const scriptSources = isDev
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self'"
  const metaCsp = [
    "default-src 'self'",
    scriptSources,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `connect-src ${connectSources}`,
    `img-src ${mediaSources}`,
    `media-src ${mediaSources}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests'])
  ].join('; ')
  const headerCsp = [
    metaCsp,
    "frame-ancestors 'none'"
  ].join('; ')

  return {
  plugins: [
    react(),
    {
      name: 'coiny-security-headers',
      transformIndexHtml(html) {
        return html.replace('__COINY_CSP__', metaCsp)
      }
    }
  ],
  base: './',
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
  },
  build: {
    assetsInlineLimit: (filePath) => (filePath && filePath.includes('worklet') ? false : undefined),
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('react')) return 'react-vendor'
          return 'vendor'
        },
      },
    },
  },
  server: {
    headers: {
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': headerCsp,
    },
  },
  preview: {
    headers: {
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': headerCsp,
    },
  },
  }
})
