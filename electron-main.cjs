const {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  net,
  protocol,
  shell
} = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_SCHEME = 'app';
const APP_HOST = 'coiny';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const ALLOWED_PERMISSIONS = new Set([
  'media',
  'display-capture',
  'notifications',
  'audioCapture',
  'videoCapture'
]);

protocol.registerSchemesAsPrivileged([{
  scheme: APP_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true
  }
}]);

let mainWindow;

function isTrustedAppUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === `${APP_SCHEME}:`
      && url.host === APP_HOST
      && !url.username
      && !url.password
      && !url.port;
  } catch {
    return false;
  }
}

function isSafeExternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function resolveAppAsset(requestUrl) {
  const url = new URL(requestUrl);
  if (url.host !== APP_HOST) return null;

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname || '/');
  } catch {
    return null;
  }

  if (pathname.includes('\0') || pathname.includes('\\')) return null;
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const distRoot = path.resolve(__dirname, 'dist');
  const resolved = path.resolve(distRoot, relativePath);
  const insideDist = resolved === distRoot || resolved.startsWith(`${distRoot}${path.sep}`);
  return insideDist ? resolved : null;
}

async function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const assetPath = resolveAppAsset(request.url);
    if (!assetPath) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(assetPath).toString());
  });
}

async function chooseDisplaySource(request, callback) {
  const trustedFrame = request.frame && isTrustedAppUrl(request.frame.url);
  const isMainFrame = request.frame && mainWindow && request.frame === mainWindow.webContents.mainFrame;
  if (!trustedFrame || !isMainFrame || request.securityOrigin !== APP_ORIGIN || !request.userGesture) {
    callback({});
    return;
  }

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      fetchWindowIcons: true,
      thumbnailSize: { width: 320, height: 180 }
    });
    if (!sources.length || !mainWindow) {
      callback({});
      return;
    }

    const cancelId = sources.length;
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Выберите экран для демонстрации',
      message: 'Coiny начнёт демонстрацию только выбранного источника.',
      buttons: [...sources.map((source) => source.name), 'Отмена'],
      cancelId,
      defaultId: cancelId,
      noLink: true
    });
    callback(result.response === cancelId ? {} : { video: sources[result.response] });
  } catch (error) {
    console.error('Display source selection failed:', error);
    callback({});
  }
}

function configureSessionSecurity(window) {
  const appSession = window.webContents.session;

  appSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => (
    Boolean(webContents)
    && isTrustedAppUrl(webContents.getURL())
    && requestingOrigin === APP_ORIGIN
    && details?.isMainFrame === true
    && (!details?.embeddingOrigin || details.embeddingOrigin === APP_ORIGIN)
    && (permission !== 'media' || details?.userGesture === true)
    && ALLOWED_PERMISSIONS.has(permission)
  ));

  appSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details?.requestingUrl || webContents.getURL();
    callback(
      isTrustedAppUrl(webContents.getURL())
      && isTrustedAppUrl(requestingUrl)
      && details?.isMainFrame === true
      && (permission !== 'media' || details?.userGesture === true)
      && ALLOWED_PERMISSIONS.has(permission)
    );
  });

  appSession.setDisplayMediaRequestHandler(chooseDisplaySource, { useSystemPicker: true });
}

function configureNavigationSecurity(window) {
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.on('will-navigate', (event, navigationDetails) => {
    const navigationUrl = typeof navigationDetails === 'string'
      ? navigationDetails
      : navigationDetails?.url;
    if (!isTrustedAppUrl(navigationUrl)) event.preventDefault();
  });

  window.webContents.on('will-frame-navigate', (event, navigationDetails) => {
    const navigationUrl = typeof navigationDetails === 'string'
      ? navigationDetails
      : navigationDetails?.url;
    if (!isTrustedAppUrl(navigationUrl)) event.preventDefault();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      setImmediate(() => shell.openExternal(url).catch((error) => {
        console.error('Failed to open external URL:', error);
      }));
    }
    return { action: 'deny' };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Coiny',
    icon: path.join(__dirname, 'dist', 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false
    }
  });

  configureSessionSecurity(mainWindow);
  configureNavigationSecurity(mainWindow);
  mainWindow.loadURL(`${APP_ORIGIN}/index.html`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await registerAppProtocol();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

module.exports = {
  isSafeExternalUrl,
  isTrustedAppUrl,
  resolveAppAsset
};
