import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { ProjectIndexer } from "./indexer";
import type { IndexProgress } from "../shared/types";

const isDevelopment = !app.isPackaged;
const rootPath = path.resolve(__dirname, "..", "..");

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDevelopment) {
    void window.loadURL("http://localhost:5173");
  } else {
    void window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }
}

app.whenReady().then(() => {
  ipcMain.handle("index:load", async (event, force = false) => {
    const notify = (progress: IndexProgress) => event.sender.send("index:progress", progress);
    return new ProjectIndexer(rootPath, notify).load(Boolean(force));
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
