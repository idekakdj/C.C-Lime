import { afterEach, expect, it, vi } from 'vitest';
import { applyAppearance } from '../../src/renderer/apply-appearance';
import { contrast } from '../../src/shared/appearance';
afterEach(()=>vi.unstubAllGlobals());
it('generates valid theme tokens and readable basic surfaces including near-threshold custom colors',()=>{
 for(const background of ['#ffffff','#111111','#747474','#777777']){
  const values=new Map<string,string>();vi.stubGlobal('document',{documentElement:{style:{setProperty:(key:string,value:string)=>values.set(key,value)},dataset:{}}});
  applyAppearance({active:'989c0ab5-1733-4f39-b8ca-6a8cc1cce297',custom:[{id:'989c0ab5-1733-4f39-b8ca-6a8cc1cce297',name:'Contrast test',colors:{background,surface:background,accent:'#456789'}}]});
  for(const value of values.values())expect(value).toMatch(/^#[a-f\d]{6}([a-f\d]{2})?$/i);
  for(const key of ['--theme-0c0b10','--theme-121017','--theme-17101f'])expect(contrast(values.get('--profile-text')!,values.get(key)!)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(values.get('--danger')!,background)).toBeGreaterThanOrEqual(4.5);
 }
});
