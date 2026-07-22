const { app, BrowserWindow, session, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: "CoinGram"
  });

  // Enable WebRTC screen sharing and media permissions handler
  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      if (sources.length > 0) {
        // Use primary monitor source if available, otherwise first source
        const primary = sources.find(s => s.name.toLowerCase().includes('screen 1') || s.name.toLowerCase().includes('entire screen') || s.name.toLowerCase().includes('экран 1')) || sources[0];
        callback({ video: primary });
      } else {
        callback({});
      }
    }).catch(err => {
      console.error("Failed to fetch display media sources:", err);
      callback({});
    });
  });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log(`Permission request: ${permission}`);
    const url = webContents.getURL();
    const isAppUrl = url.startsWith('file://') || url.startsWith('http://localhost');
    if (!isAppUrl) {
      console.warn('Denied permission for external URL:', url);
      return callback(false);
    }
    
    if (['media', 'display-capture', 'notifications', 'audioCapture', 'videoCapture'].includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require('electron');
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the built files from Vite's dist directory
  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});
