import type { Page } from '@playwright/test';
export interface AcceptanceCopy { root: string; executable: string; version: string; packageSha256: string;
 policy: {mode: string; executableSha256: string; archiveSha256: string; fuses: Record<string, boolean | 'removed'>; staticHeaderMatches: boolean}; }
export interface IndependentDesktop { page: Page; close(): Promise<void>; nodeInspectorAnnounced(): boolean; }
export function acceptanceCopy(disableInspection?: boolean, allFuses?: boolean): Promise<AcceptanceCopy>;
export function rendererCopy(): Promise<AcceptanceCopy>;
export function startDesktop(copy: AcceptanceCopy, profile: string, inspectPort?: number, probe?: {nodeScript?: string}): Promise<IndependentDesktop>;
