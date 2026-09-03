const { app, BrowserWindow, Menu, screen } = require('electron');
const path = require('path');

function createWindow() {
  // Start with a generous, roughly square window. The game computes its own
  // layout from window size and switches to a cramped "rotated controls" mode
  // if the window isn't wide enough relative to its height - starting square
  // (and reasonably large) avoids that.
  const work = screen.getPrimaryDisplay().workAreaSize;
  const initialSize = Math.max(600, Math.min(900, work.width - 80, work.height - 80));

  const win = new BrowserWindow({
    width: initialSize,
    height: initialSize,
    show: false, // stay hidden until we've resized to fit, to avoid a visible jump
    resizable: true,
    icon: path.join(__dirname, 'favicon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Hide the default menu bar (File/Edit/View/...) entirely
  Menu.setApplicationMenu(null);

  win.loadFile('index.html');

  win.webContents.on('did-finish-load', () => {
    // The game lays itself out via internal setTimeouts (~350ms worst case);
    // wait a bit longer, then measure how much space it actually used.
    setTimeout(function () {
      win.webContents.executeJavaScript(
        '({ w: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),' +
        '   h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) })'
      ).then(function (size) {
        if (size && size.w > 0 && size.h > 0) {
          win.setContentSize(Math.ceil(size.w), Math.ceil(size.h));
          win.center();
        }
      }).catch(function () {
        // fall back to the initial guessed size
      }).finally(function () {
        win.show();
      });
    }, 700);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
