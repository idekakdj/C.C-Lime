import { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, safeStorage, shell, dialog, protocol, net, powerMonitor, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { ZodError } from 'zod';
import { ApplicationService } from './service';
import { loadCloudConfiguration } from './config';
import { appProtocol, isAppDocument } from './app-protocol';
import { prepareAvatar } from './avatar';
import { STARTUP_NAME, STARTUP_ARGS, startupQuery, startupState } from './startup';
import { WINDOWS_IDENTITIES, squirrelInstallation, isRegularFile, shortcutIO, repairInstalledShortcuts, removeInstalledRootShortcut, squirrelEvent, handleSquirrelEvent, runUpdater } from './windows-integration';

app.setName('C.C. Lime');
if(process.env.CC_LIME_DATA_DIR&&!app.isPackaged)app.setPath('userData',path.resolve(process.env.CC_LIME_DATA_DIR));
const testProfile=process.argv.find(arg=>arg.startsWith('--cc-lime-test-profile='));
if(testProfile)app.setPath('userData',path.resolve(testProfile.split('=').slice(1).join('=')));
const installation=squirrelInstallation(process.platform,app.isPackaged,process.execPath,isRegularFile);
const identity=testProfile?WINDOWS_IDENTITIES.test:installation?WINDOWS_IDENTITIES.installed:WINDOWS_IDENTITIES.preview;
if(process.platform==='win32'){
  // Preserve the calendar path while keeping preview/test notification registrations separate.
  const profile=app.getPath('userData');app.setName(identity.name);app.setPath('userData',profile);
  app.setAppUserModelId(identity.id);app.setToastActivatorCLSID(identity.clsid);
}
const shortcutPaths=()=>({appData:app.getPath('appData'),desktop:app.getPath('desktop'),profile:app.getPath('userData')});
const repairShortcuts=()=>{if(installation&&!testProfile)repairInstalledShortcuts(installation,shortcutPaths(),shortcutIO(shell));};
protocol.registerSchemesAsPrivileged([{scheme:'cclime',privileges:{standard:true,secure:true,supportFetchAPI:true,allowServiceWorkers:false,bypassCSP:false}}]);
let window:BrowserWindow|null=null,tray:Tray|null=null,service:ApplicationService|null=null;
let quitting=false,shutdownDone=false;let changeTimer:ReturnType<typeof setTimeout>|null=null;
const notices=new Set<Notification>();
function show(target?:{itemId?:string;occurrenceKey?:string;action?:string}){if(!window)return;window.show();if(window.isMinimized())window.restore();window.focus();if(target)window.webContents.send('lime:navigate',target);}
const installerEvent=squirrelEvent(process.platform,process.argv);
const primary=!installerEvent&&app.requestSingleInstanceLock();
if(installerEvent){
  void handleSquirrelEvent(installerEvent,installation,{ready:()=>app.whenReady(),run:runUpdater,repair:repairShortcuts,cleanup:()=>{
    if(installation){removeInstalledRootShortcut(installation,shortcutPaths(),shortcutIO(shell));app.setLoginItemSettings({openAtLogin:false,path:installation.launcher,args:STARTUP_ARGS,name:STARTUP_NAME});}
  }}).then(()=>app.quit(),()=>app.exit(1));
}else if(!primary)app.quit();
else{
  app.on('second-instance',()=>show());app.on('activate',()=>show());
  app.on('before-quit',event=>{quitting=true;if(!shutdownDone&&service){event.preventDefault();void service.close().finally(()=>{shutdownDone=true;app.quit();});}});
  app.whenReady().then(async()=>{
    const root=app.getPath('userData');fs.mkdirSync(root,{recursive:true});
    // Electron derives its Windows shortcut filename from the EXE resource, not app.setName.
    // Never initialize that presenter in previews/tests: it would rewrite the installed shortcut.
    let notificationSetupFailed=process.platform==='win32'&&(!installation||!!testProfile);
    try{repairShortcuts();if(process.platform==='win32'&&!notificationSetupFailed)Notification.isSupported();}catch{notificationSetupFailed=true;}
    const iconPath=app.isPackaged?path.join(process.resourcesPath,'icon.png'):path.join(app.getAppPath(),'assets/icon.png');
    const rendererRoot=path.resolve(__dirname,'../renderer');
    protocol.handle('cclime',appProtocol(rendererRoot,url=>net.fetch(url)));
    session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));session.defaultSession.setPermissionCheckHandler(()=>false);
    const updateTray=()=>tray?.setContextMenu(Menu.buildFromTemplate([{label:'Open C.C. Lime',click:()=>show()},{label:'Add item',click:()=>show({action:'new'})},{label:service?.device.notifications?'Pause reminders':'Enable reminders',click:()=>void service?.command('device',{notifications:!service.device.notifications}).catch(()=>{})},{label:'Settings',click:()=>show({action:'settings'})},{type:'separator'},{label:'Quit C.C. Lime',click:()=>{void quitWithNotice();}}]));
    const changed=()=>{if(changeTimer)return;changeTimer=setTimeout(()=>{changeTimer=null;if(!window?.isDestroyed())window?.webContents.send('lime:changed');updateTray();},80);};
    const config=loadCloudConfiguration(root,app.isPackaged?undefined:app.getAppPath());
    service=new ApplicationService(root,config,{
      secure:safeStorage,version:app.getVersion(),changed,
      chooseAvatar:async()=>{const result=await dialog.showOpenDialog(window!,{title:'Choose a profile photo',properties:['openFile'],filters:[{name:'PNG or JPEG photo',extensions:['png','jpg','jpeg']}]});return result.canceled||!result.filePaths[0]?null:prepareAvatar(result.filePaths[0],bytes=>nativeImage.createFromBuffer(bytes));},
      openBrowser:async url=>{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!=='accounts.google.com')throw new Error('Unsupported sign-in address.');await shell.openExternal(url);},
      notify:notice=>{if(notificationSetupFailed||!Notification.isSupported()){notice.onFailure();return;}const notification=new Notification({title:notice.title,body:notice.body,icon:iconPath,silent:false});notices.add(notification);notification.on('click',()=>show(notice.inbox?{action:'inbox'}:{itemId:notice.itemId,occurrenceKey:notice.occurrenceKey}));notification.on('failed',()=>{notice.onFailure();notices.delete(notification);});notification.on('close',()=>notices.delete(notification));notification.show();},
      openFile:async kind=>{const result=await dialog.showOpenDialog(window!,{title:kind==='ics'?'Import calendar':'Restore calendar backup',properties:['openFile'],filters:[{name:kind==='ics'?'Calendar file':'C.C. Lime backup',extensions:kind==='ics'?['ics']:['json']} ]});return result.canceled?null:result.filePaths[0];},
      saveFile:async kind=>{const result=await dialog.showSaveDialog(window!,{title:kind==='ics'?'Export calendar':kind==='backup'?'Save full backup':'Save diagnostics',defaultPath:`CC-Lime-${kind}-${new Date().toISOString().slice(0,10)}.${kind==='ics'?'ics':'json'}`,filters:[{name:kind==='ics'?'Calendar file':'JSON file',extensions:[kind==='ics'?'ics':'json']} ]});return result.canceled?null:result.filePath??null;},
      setStartup:enabled=>{
        if(!app.isPackaged||process.platform==='win32'&&(!installation||testProfile)){
          if(enabled)throw new Error('Startup can only be changed in the installed app.');
          return; // Choosing preview defaults must not alter the installed app's entry.
        }
        const launcher=installation?.launcher??process.execPath;
        app.setLoginItemSettings({openAtLogin:enabled,enabled,path:launcher,args:STARTUP_ARGS,name:STARTUP_NAME});
      },
      startupStatus:()=>{if(process.platform==='win32'&&(!installation||testProfile))return{enabled:false,registered:false,wasOpenedAtLogin:false};const launcher=installation?.launcher??process.execPath;return startupState(process.platform,launcher,app.getLoginItemSettings(startupQuery(process.platform,launcher)));},
      dataFolder:()=>{void shell.openPath(service?.store?.directory??root);},
    });
    window=new BrowserWindow({width:1480,height:960,minWidth:760,minHeight:600,show:!process.argv.includes('--background'),backgroundColor:'#0c0b10',title:'C.C. Lime',icon:iconPath,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,devTools:!app.isPackaged}});
    window.setMenuBarVisibility(false);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',(event,url)=>{if(!isAppDocument(url))event.preventDefault();});window.webContents.on('will-attach-webview',event=>event.preventDefault());
    window.on('show',()=>service?.setVisible(true));window.on('hide',()=>service?.setVisible(false));
    window.on('close',event=>{if(!quitting&&service?.device.closeToTray){event.preventDefault();window?.hide();const marker=path.join(root,'tray-explained');if(!fs.existsSync(marker)){fs.writeFileSync(marker,'1');void dialog.showMessageBox({type:'info',title:'C.C. Lime is still running',message:'Your calendar is in the system tray.',detail:'Reminders continue while your laptop is awake. Use the tray menu to reopen C.C. Lime or quit it completely.'});}}else if(!quitting){event.preventDefault();void quitWithNotice();}});
    tray=new Tray(nativeImage.createFromPath(iconPath).resize({width:24,height:24}));tray.setToolTip('C.C. Lime');tray.on('double-click',()=>show());updateTray();
    const devUrl=!app.isPackaged?process.env.CC_LIME_DEV_URL:undefined;if(devUrl&&devUrl!=='http://127.0.0.1:5173')throw new Error('Unsupported development origin.');
    ipcMain.handle('lime:command',async(event,command:unknown,payload:unknown)=>{
      const url=event.senderFrame?.url??'';if(event.sender!==window?.webContents||event.senderFrame!==window.webContents.mainFrame||!(isAppDocument(url)||!!devUrl&&url.split('#')[0]===`${devUrl}/`))throw new Error('Invalid sender.');
      if(typeof command!=='string'||command.length>64||JSON.stringify(payload??null).length>1024*1024)return{ok:false,error:'Invalid request.'};
      try{return{ok:true,result:await service!.command(command,payload)};}catch(error){return{ok:false,error:error instanceof ZodError?error.issues.map(i=>`${i.path.join('.')||'Value'}: ${i.message}`).slice(0,5).join('\n'):error instanceof Error?error.message:'This action could not be completed.'};}
    });
    await service.initialize();await window.loadURL(devUrl??'cclime://app/index.html');powerMonitor.on('resume',()=>service?.resume());powerMonitor.on('unlock-screen',()=>service?.resume());
    app.once('will-quit',()=>{if(changeTimer)clearTimeout(changeTimer);tray?.destroy();});
    async function quitWithNotice(){const marker=path.join(root,'quit-explained');if(!fs.existsSync(marker)){const result=await dialog.showMessageBox(window!,{type:'question',buttons:['Keep running','Quit C.C. Lime'],defaultId:0,cancelId:0,message:'Quit C.C. Lime?',detail:'Desktop reminders stop until you open the app again. Your saved calendar stays on this computer.'});if(result.response!==1)return;fs.writeFileSync(marker,'1');}app.quit();}
  }).catch(error=>{dialog.showErrorBox('C.C. Lime could not start',error instanceof Error?error.message:'Unexpected startup error.');app.quit();});
}
