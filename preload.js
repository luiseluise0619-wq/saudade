'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('auraAPI', {
    fetchRSSOne(url) {
        return ipcRenderer.invoke('rss:fetch-one', url);
    },
    fetchJSON(url) {
        return ipcRenderer.invoke('json:fetch', url);
    },
});
