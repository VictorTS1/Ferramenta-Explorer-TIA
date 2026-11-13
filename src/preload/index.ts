import { contextBridge, ipcRenderer } from "electron";
import type { ExplorerApi, IndexProgress } from "../shared/types";

const explorerApi: ExplorerApi = {
  loadIndex: (force = false) => ipcRenderer.invoke("index:load", force),
  listHelpDocuments: () => ipcRenderer.invoke("help:list"),
  openHelp: (helpId) => ipcRenderer.invoke("help:open", helpId),
  onProgress: (listener) => {
    const callback = (_event: Electron.IpcRendererEvent, progress: IndexProgress) => listener(progress);
    ipcRenderer.on("index:progress", callback);
    return () => ipcRenderer.removeListener("index:progress", callback);
  }
};

contextBridge.exposeInMainWorld("explorer", explorerApi);
