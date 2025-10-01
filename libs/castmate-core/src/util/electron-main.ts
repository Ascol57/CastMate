// Electron functions for use in main process only
// These functions use ipcMain and should not be imported in renderer process

export {
	defineIPCFunc,
	defineIPCFuncRaw,
	defineCallableIPC
} from "./electron"