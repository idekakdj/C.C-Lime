import { contextBridge, ipcRenderer } from 'electron';
import type { LimeApi } from '../shared/model';
const api:LimeApi={
  async call(command,payload){const response=await ipcRenderer.invoke('lime:command',command,payload);if(!response.ok)throw new Error(response.error);return response.result;},
  onChange(callback){const listener=()=>callback();ipcRenderer.on('lime:changed',listener);return()=>ipcRenderer.removeListener('lime:changed',listener);},
  onNavigate(callback){const listener=(_event:Electron.IpcRendererEvent,target:{itemId?:string;action?:string})=>callback(target);ipcRenderer.on('lime:navigate',listener);return()=>ipcRenderer.removeListener('lime:navigate',listener);},
};
contextBridge.exposeInMainWorld('lime',api);
