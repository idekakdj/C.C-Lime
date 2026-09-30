import { z } from 'zod';

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color.');
export function luminance(hex: string): number {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
export function contrast(a: string, b: string): number { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
export function foreground(...backgrounds: string[]): string {
  return ['#ffffff', '#000000'].sort((a, b) => Math.min(...backgrounds.map(c => contrast(b, c))) - Math.min(...backgrounds.map(c => contrast(a, c))))[0];
}
export const paletteSchema = z.object({ background: hexColor, surface: hexColor, accent: hexColor }).strict().refine(p => {
  const ink = foreground(p.background, p.surface); return contrast(ink, p.background) >= 4.5 && contrast(ink, p.surface) >= 4.5;
}, 'Choose two light backgrounds or two dark backgrounds so text stays readable.');
export type Palette = z.infer<typeof paletteSchema>;
export const presets = [
  { id: 'purple', name: 'Purple & black', background: '#0c0b10', surface: '#17121f', accent: '#b39ae8' },
  { id: 'mono', name: 'Black & white', background: '#080808', surface: '#191919', accent: '#ffffff' },
  { id: 'navy', name: 'Navy & gold', background: '#071426', surface: '#10253f', accent: '#edc568' },
] as const;
export const customThemeSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(32), colors: paletteSchema }).strict();
export const appearanceSchema = z.object({ active: z.string().max(36), custom: z.array(customThemeSchema).max(3, 'You can save up to three custom themes.') }).strict().superRefine((value, ctx) => {
  if (new Set(value.custom.map(t => t.id)).size !== value.custom.length) ctx.addIssue({ code: 'custom', message: 'Custom themes need unique identities.' });
  if (!presets.some(p => p.id === value.active) && !value.custom.some(p => p.id === value.active)) ctx.addIssue({ code: 'custom', message: 'Choose a saved theme.' });
});
export type Appearance = z.infer<typeof appearanceSchema>;
export const defaultAppearance: Appearance = { active: 'purple', custom: [] };
export function activePalette(appearance: Appearance): Palette { const p=presets.find(p => p.id === appearance.active) ?? appearance.custom.find(p => p.id === appearance.active)?.colors ?? presets[0];return {background:p.background,surface:p.surface,accent:p.accent}; }
