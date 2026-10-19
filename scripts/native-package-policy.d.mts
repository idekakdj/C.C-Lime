export const fuseSentinel: Buffer;
export const fuseNames: readonly string[];
export interface ElectronFuses { version: number; values: Record<string, boolean | 'removed'>; }
export function readElectronFuses(bytes: Buffer): ElectronFuses;
export function hardeningGaps(fuses: ElectronFuses): Array<{ name: string; observed: boolean | 'removed' | 'unknown'; desired: boolean }>;
