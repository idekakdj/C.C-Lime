import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { LocalStore } from '../../src/main/store';
import { ReminderScheduler, inQuietHours, type ReminderNotice } from '../../src/main/scheduler';
import { defaultDeviceSettings } from '../../src/shared/model';
import { item, millis } from '../fixtures';
const roots: string[] = []; const stores: LocalStore[] = []; const schedulers: ReminderScheduler[] = [];
afterEach(() => { schedulers.splice(0).forEach(s => s.stop()); stores.splice(0).forEach(s => s.close()); for (const root of roots.splice(0)) if (root.startsWith(path.join(os.tmpdir(),'cc-lime-scheduler-'))) fs.rmSync(root,{recursive:true,force:true}); });
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'cc-lime-scheduler-')); roots.push(root);
  const store = new LocalStore(root,'test'); stores.push(store);
  let now = millis('2026-09-18T08:45'); const device = { ...defaultDeviceSettings, notifications: true }; const notices: ReminderNotice[] = [];
  const scheduler = new ReminderScheduler(store,()=>device,()=> 'America/Toronto', n => notices.push(n),()=>{},()=>now); schedulers.push(scheduler);
  const value = item({ reminders:[{id:randomUUID(),minutesBefore:15}] }); store.save(value);
  return { root, store, scheduler, device, notices, value, advance: (ms: number) => now += ms };
}
describe('durable reminder scheduler', () => {
  it('emits a due reminder once and does not re-arm on title edits or backward clock jumps', () => {
    const t = setup(); t.scheduler.reconcile(false); expect(t.notices).toHaveLength(1);
    t.store.save({...t.value,title:'Changed title'}); t.scheduler.reconcile(false); t.advance(-60000); t.scheduler.reconcile(false); t.advance(60000); t.scheduler.reconcile(false);
    expect(t.notices).toHaveLength(1); expect(t.store.reminders()[0].state).toBe('emitted');
  });
  it('cancels pending reminders on completion and only rearms future changed timing', () => {
    const t = setup(); t.advance(-60000); t.scheduler.reconcile(false); t.store.save({...t.value,status:'completed'}); t.advance(60000); t.scheduler.reconcile(false); expect(t.notices).toHaveLength(0);
    t.store.save({...t.value,timing:{mode:'timed',zone:'America/Toronto',start:'2026-09-18T14:00:00Z',end:'2026-09-18T15:00:00Z'}}); t.scheduler.reconcile(false); t.advance(3600000); t.scheduler.reconcile(false); expect(t.notices).toHaveLength(1);
  });
  it('suppresses quiet hours and emits one summary when quiet hours end', () => {
    const t = setup(); t.device.quietStart='22:00'; t.device.quietEnd='09:00'; t.scheduler.reconcile(false); expect(t.notices).toHaveLength(0); expect(t.store.reminders()[0].state).toBe('suppressed');
    t.advance(15*60000); t.scheduler.reconcile(false); expect(t.notices).toHaveLength(1); expect(t.notices[0].inbox).toBe(true);
  });
  it('snoozes persist and completion cancels a snooze', () => {
    const t = setup(); t.scheduler.reconcile(false); const id=t.store.reminders()[0].id; t.scheduler.snooze(id,5); t.scheduler.stop();
    const other = new LocalStore(t.root,'test'); stores.push(other); expect(other.reminders()[0].state).toBe('snoozed');
    t.store.save({...t.value,status:'completed'}); const resumed=new ReminderScheduler(t.store,()=>t.device,()=> 'America/Toronto',n=>t.notices.push(n),()=>{},()=>millis('2026-09-18T08:51')); schedulers.push(resumed); resumed.reconcile(false); expect(t.notices).toHaveLength(1); expect(t.store.reminders()[0].state).toBe('canceled');
  });
  it('marks an interrupted dispatch uncertain without replaying a popup', () => {
    const t=setup(); t.scheduler.reconcile(false); t.store.putReminder({...t.store.reminders()[0],state:'dispatching'}); t.store.close(); const recovered=new LocalStore(t.root,'test'); stores.push(recovered); expect(recovered.reminders()[0].state).toBe('uncertain');
    const resumed=new ReminderScheduler(recovered,()=>t.device,()=> 'America/Toronto',n=>t.notices.push(n),()=>{},()=>millis('2026-09-18T08:46')); schedulers.push(resumed); resumed.reconcile(false); expect(t.notices).toHaveLength(1);
  });
  it('aggregates more than three catch-up reminders and respects privacy', () => {
    const t=setup(); for(let i=0;i<3;i++) t.store.save(item({reminders:[{id:randomUUID(),minutesBefore:15}]})); t.device.privacy=true; t.scheduler.reconcile(false); expect(t.notices).toHaveLength(1); expect(t.notices[0].inbox).toBe(true); expect(t.notices[0].title).toBe('C.C. Lime reminder');
  });
  it('reports OS submission failure and leaves inbox evidence', () => { const t=setup(); t.scheduler.reconcile(false); t.notices[0].onFailure(); expect(t.store.reminders()[0].state).toBe('failed'); t.scheduler.reconcile(false); expect(t.notices).toHaveLength(1); });
  it('handles daytime and overnight quiet windows in the selected time zone',()=>{ expect(inQuietHours(millis('2026-09-18T23:30'),'America/Toronto','22:00','07:00')).toBe(true); expect(inQuietHours(millis('2026-09-18T07:00'),'America/Toronto','22:00','07:00')).toBe(false); expect(inQuietHours(millis('2026-09-18T13:00'),'America/Toronto','12:00','14:00')).toBe(true); });
});
