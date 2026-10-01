// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from '../../src/renderer/screens';
import { defaultDeviceSettings, preferencesSchema, type Snapshot } from '../../src/shared/model';
afterEach(cleanup);
it('distinguishes missing, disabled and enabled startup and supports applying the saved preference',async()=>{
 const run=vi.fn(async()=>true),prefs=preferencesSchema.parse({id:'c44ba791-5ae6-5ec6-9813-0c840db2f0f2',kind:'preferences',zone:'America/Toronto'});
 const snapshot:Snapshot={device:{...defaultDeviceSettings,startAtLogin:true},records:[],session:null,localMode:true,sync:{message:'Local',lastSynced:null,pending:0,state:'local'},conflicts:[],reminders:[],configured:false,googleConfigured:false,version:'test'};
 const props={prefs,run,openData:vi.fn()};
 const {rerender}=render(<SettingsScreen {...props} snapshot={{...snapshot,startup:{registered:false,enabled:false}}}/>);
 expect(screen.getByText(/startup entry is missing/)).toBeTruthy();expect(screen.queryByText(/Windows has disabled/)).toBeNull();
 await userEvent.setup().click(screen.getByRole('button',{name:'Apply startup preference'}));
 expect(run).toHaveBeenCalledWith('device',{startAtLogin:true},'Startup preference applied');
 rerender(<SettingsScreen {...props} snapshot={{...snapshot,startup:{registered:true,enabled:false}}}/>);
 expect(screen.getByText(/Windows has disabled/)).toBeTruthy();expect(screen.queryByText(/startup entry is missing/)).toBeNull();
 rerender(<SettingsScreen {...props} snapshot={{...snapshot,startup:{registered:true,enabled:true}}}/>);
 expect(screen.getByText('Windows startup is enabled for C.C. Lime.')).toBeTruthy();expect(screen.queryByRole('button',{name:'Apply startup preference'})).toBeNull();
});
