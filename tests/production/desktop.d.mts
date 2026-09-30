import type { Page } from '@playwright/test';
export interface AcceptanceCopy { root: string; executable: string; version: string; }
export interface IndependentDesktop { page: Page; close(): Promise<void>; }
export function acceptanceCopy(): Promise<AcceptanceCopy>;
export function startDesktop(copy: AcceptanceCopy, profile: string): Promise<IndependentDesktop>;
