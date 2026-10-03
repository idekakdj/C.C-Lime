import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readBoundedText } from '../../src/main/bounded-file';
let root:string;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-bounded-'));});
afterEach(()=>{vi.restoreAllMocks();if(path.dirname(root)!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('cc-lime-bounded-'))throw Error('Unsafe fixture cleanup');fs.rmSync(root,{recursive:true,force:true});});
it('reads empty and exactly bounded UTF-8 files and rejects oversize before opening',()=>{
 const file=path.join(root,'input');fs.writeFileSync(file,'');expect(readBoundedText(file,4,'Calendar')).toBe('');
 fs.writeFileSync(file,'éé');expect(readBoundedText(file,4,'Calendar')).toBe('éé');
 fs.appendFileSync(file,'x');const open=vi.spyOn(fs,'openSync');expect(()=>readBoundedText(file,4,'Calendar')).toThrow(/limit/);expect(open).not.toHaveBeenCalled();
});
it('rejects directories and symlinks to otherwise valid files',()=>{
 expect(()=>readBoundedText(root,10,'Calendar')).toThrow(/regular/);
 const link=path.join(root,'junction');fs.symlinkSync(root,link,'junction');expect(()=>readBoundedText(link,10,'Calendar')).toThrow(/regular/);
});
it('rechecks the opened descriptor after a file grows between lstat and open',()=>{
 const file=path.join(root,'input');fs.writeFileSync(file,'ok');const original=fs.lstatSync;
 vi.spyOn(fs,'lstatSync').mockImplementation(((name:fs.PathLike)=>{const stat=original(name);fs.appendFileSync(file,'more than permitted');return stat;}) as typeof fs.lstatSync);
 const close=vi.spyOn(fs,'closeSync');expect(()=>readBoundedText(file,4,'Calendar')).toThrow(/limit/);expect(close).toHaveBeenCalledOnce();
});
it('reads at most limit plus one byte when a file grows after both stat checks',()=>{
 const file=path.join(root,'input');fs.writeFileSync(file,'ok');const original=fs.fstatSync;
 vi.spyOn(fs,'fstatSync').mockImplementation(((fd:number)=>{const stat=original(fd);fs.appendFileSync(file,'large growing content');return stat;}) as typeof fs.fstatSync);
 const read=vi.spyOn(fs,'readSync'),close=vi.spyOn(fs,'closeSync');expect(()=>readBoundedText(file,4,'Calendar')).toThrow(/limit/);
 expect(read).toHaveBeenCalledOnce();expect((read.mock.calls as unknown[][])[0][3]).toBe(5);expect(close).toHaveBeenCalledOnce();
});
