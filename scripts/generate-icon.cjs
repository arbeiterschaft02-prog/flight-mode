/**
 * Renders the Flight Mode mark to resources/icon.png (512×512) using an
 * offscreen Electron window, so no image tooling is needed. electron-builder
 * converts it to a multi-size .ico for Windows.
 *
 *   npm run icon
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SIZE = 512;
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16264a"/><stop offset="1" stop-color="#0a1428"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="30" height="30" rx="7.5" fill="url(#g)"/>
  <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="7.25" fill="none" stroke="#7aaaff" stroke-opacity="0.25" stroke-width="0.5"/>
  <path d="M7 23.5h18" stroke="#7aaaff" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>
  <path d="M9.2 18.6 21.4 9.8c.9-.6 2.1-.4 2.6.4.4.6.2 1.4-.4 1.8l-3.6 2.6.9 6.1-1.4 1-2.4-5.2-3.5 2.5.2 2.3-1 .7-1.4-2.8-2.8-1.3 1-.7 2.3.3Z" fill="#ffffff"/>
</svg>`;

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true }
  });
  win.webContents.setFrameRate(5);
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((r) => setTimeout(r, 600));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  const out = path.join(__dirname, '..', 'resources', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, image.resize({ width: SIZE, height: SIZE }).toPNG());
  console.log('Wrote', out);
  app.exit(0);
});
