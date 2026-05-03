'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');

const isDev = process.argv.includes('--dev') || !app.isPackaged;

const RSS_HOSTS = new Set([
    'feeds.bbci.co.uk',
    'www.cnbc.com',
    'rss.dw.com',
    'www.france24.com',
    'feeds.npr.org',
    'feeds.feedburner.com',
    'www.theguardian.com',
    'www.wired.com',
    'www.theverge.com',
    'techcrunch.com',
    'www.politico.com',
    'moxie.foxbusiness.com',
    'nypost.com',
    'www.telegraph.co.uk',
    'thehill.com',
    'www.dailywire.com',
    'feeds.bloomberg.com',
    'feeds.content.dowjones.io',
    'www.economist.com',
    'feeds.arstechnica.com',
    'www.engadget.com',
    'hnrss.org',
    'www.technologyreview.com',
    'venturebeat.com',
    'en.yna.co.kr',
    'www.koreaherald.com',
    'www.japantimes.co.jp',
    'www3.nhk.or.jp',
    'www.scmp.com',
    'www.straitstimes.com',
    'www.lemonde.fr',
    'www.spiegel.de',
    'www.politico.eu',
    'www.irishtimes.com',
    'www.cbc.ca',
    'www.abc.net.au',
    'kyivindependent.com',
    'www.xinhuanet.com',
]);

const JSON_HOSTS = new Set([
    'saudade.absbjj1230.workers.dev',
    'lounj.absbjj1230.workers.dev',
    'api.open-meteo.com',
    'air-quality-api.open-meteo.com',
    'earthquake.usgs.gov',
    'eonet.gsfc.nasa.gov',
    'opensky-network.org',
    'www.reddit.com',
    'wikimedia.org',
    'en.wikipedia.org',
    'api.frankfurter.app',
    'open.er-api.com',
    'api.exchangerate.host',
]);

function parseAllowedUrl(rawUrl, allowedHosts) {
    const parsed = new URL(String(rawUrl));
    if (!/^https?:$/.test(parsed.protocol)) {
        throw new Error(`Blocked non-http URL: ${parsed.protocol}`);
    }
    if (!allowedHosts.has(parsed.hostname)) {
        throw new Error(`Blocked host: ${parsed.hostname}`);
    }
    return parsed;
}

async function fetchText(rawUrl, allowedHosts) {
    const url = parseAllowedUrl(rawUrl, allowedHosts);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'Accept': '*/*',
                'User-Agent': 'AURA-WorldPulse/1.0 Electron',
            },
        });

        return {
            ok: response.ok,
            status: response.status,
            body: await response.text(),
        };
    } finally {
        clearTimeout(timer);
    }
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 640,
        backgroundColor: '#F2EEE3',
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    win.once('ready-to-show', () => win.show());
    win.webContents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: 'deny' };
    });

    void win.loadFile('index.html');

    if (isDev) {
        win.webContents.openDevTools({ mode: 'detach' });
    }
}

ipcMain.handle('rss:fetch-one', async (_event, url) => fetchText(url, RSS_HOSTS));
ipcMain.handle('json:fetch', async (_event, url) => fetchText(url, JSON_HOSTS));

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
