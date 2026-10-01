import type { Page } from '@playwright/test';
export interface AcceptanceCopy { root: string; executable: string; version: string; packageSha256: string; }
export interface IndependentDesktop { page: Page; close(): Promise<void>; nodeInspectorAnnounced(): boolean; }
export function acceptanceCopy(disableInspection?: boolean): Promise<AcceptanceCopy>;
export function startDesktop(copy: AcceptanceCopy, profile: string, inspectPort?: number): Promise<IndependentDesktop>;
