const path = require('node:path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

module.exports = async function applyElectronFuses(context) {
  const productFilename = context.packager.appInfo.productFilename;
  let executablePath;

  if (context.electronPlatformName === 'win32') {
    executablePath = path.join(context.appOutDir, `${productFilename}.exe`);
  } else if (context.electronPlatformName === 'darwin') {
    executablePath = path.join(
      context.appOutDir,
      `${productFilename}.app`,
      'Contents',
      'MacOS',
      productFilename
    );
  } else {
    executablePath = path.join(context.appOutDir, productFilename);
  }

  await flipFuses(executablePath, {
    version: FuseVersion.V1,
    strictlyRequireAllFuses: true,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    [FuseV1Options.WasmTrapHandlers]: true
  });
};
