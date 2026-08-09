import path from 'node:path';
import { existsSync } from 'node:fs';
import { FuseState, FuseV1Options, FuseVersion, getCurrentFuseWire } from '@electron/fuses';

const executable = path.resolve(process.argv[2] || 'dist-electron/win-unpacked/Coiny.exe');
if (!existsSync(executable)) throw new Error(`Packaged Electron executable is missing: ${executable}`);

const wire = await getCurrentFuseWire(executable);
if (wire.version !== FuseVersion.V1) throw new Error(`Unsupported Electron fuse schema: ${wire.version}`);

const expected = new Map([
  [FuseV1Options.RunAsNode, FuseState.DISABLE],
  [FuseV1Options.EnableCookieEncryption, FuseState.ENABLE],
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE],
  [FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE],
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE],
  [FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE],
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, FuseState.ENABLE],
  [FuseV1Options.GrantFileProtocolExtraPrivileges, FuseState.DISABLE],
  [FuseV1Options.WasmTrapHandlers, FuseState.ENABLE]
]);

for (const [fuse, state] of expected) {
  if (wire[fuse] !== state) throw new Error(`Unsafe Electron fuse: ${FuseV1Options[fuse]}`);
}

console.log(`Verified ${expected.size} Electron security fuses in ${path.basename(executable)}.`);
