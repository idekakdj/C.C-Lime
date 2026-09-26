import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
function directory(root:string,accountId:string){return path.resolve(root,'accounts',createHash('sha256').update(accountId).digest('hex').slice(0,32));}
export function recoverySnapshots(root:string,accountId:string):Array<{name:string;modifiedAt:string}>{
  const folder=path.join(directory(root,accountId),'backups');if(!fs.existsSync(folder))return [];
  return fs.readdirSync(folder).filter(name=>name.endsWith('.sqlite')&&path.basename(name)===name).map(name=>({name,modifiedAt:fs.statSync(path.join(folder,name)).mtime.toISOString()})).sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt));
}
export function recoverSnapshot(root:string,accountId:string,name:string):void{
  if(!recoverySnapshots(root,accountId).some(value=>value.name===name))throw new Error('Choose an available recovery snapshot.');
  const folder=directory(root,accountId),source=path.join(folder,'backups',name),copy=path.join(folder,`recovery-${randomUUID()}.sqlite`);
  fs.copyFileSync(source,copy);let db:Database.Database|undefined;
  try{db=new Database(copy,{readonly:true});if(db.pragma('quick_check',{simple:true})!=='ok')throw new Error('This recovery snapshot is damaged.');const version=Number(db.pragma('user_version',{simple:true}));if(version!==1)throw new Error('This snapshot needs a different app version.');db.prepare('SELECT id,payload FROM records LIMIT 1').all();}
  catch(error){db?.close();db=undefined;fs.unlinkSync(copy);throw error;}finally{db?.close();}
  const quarantine=path.join(folder,`preserved-before-recovery-${randomUUID()}`);fs.mkdirSync(quarantine);
  const moved:string[]=[];
  try{for(const name of ['calendar.sqlite','calendar.sqlite-wal','calendar.sqlite-shm'])if(fs.existsSync(path.join(folder,name))){fs.renameSync(path.join(folder,name),path.join(quarantine,name));moved.push(name);}fs.renameSync(copy,path.join(folder,'calendar.sqlite'));}
  catch(error){for(const name of moved.reverse())if(!fs.existsSync(path.join(folder,name)))fs.renameSync(path.join(quarantine,name),path.join(folder,name));if(fs.existsSync(copy))fs.unlinkSync(copy);throw error;}
}
