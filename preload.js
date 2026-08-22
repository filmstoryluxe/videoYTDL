const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('videografiasi', {
  search: query => ipcRenderer.invoke('search', query),
  searchMore: () => ipcRenderer.invoke('search-more'),
  download: request => ipcRenderer.invoke('download', request),
  getInfo: url => ipcRenderer.invoke('get-info', url),
  onProgress: callback => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('progress', handler);
    return () => ipcRenderer.removeListener('progress', handler);
  }
});
