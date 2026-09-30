import { activePalette, defaultAppearance, foreground, contrast, luminance, type Appearance, type Palette } from '../shared/appearance';
import { themeColors } from './theme-colors';

function mix(a: string, b: string, fraction: number): string { return '#' + [1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-fraction)+parseInt(b.slice(i,i+2),16)*fraction).toString(16).padStart(2,'0')).join(''); }
function recolor(value: string, p: Palette): string {
  const raw=value.length===4||value.length===5?'#'+[...value.slice(1)].map(c=>c+c).join(''):value, color=raw.slice(0,7), alpha=raw.slice(7);
  const [r,g,b]=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)), max=Math.max(r,g,b), min=Math.min(r,g,b), sat=max?(max-min)/max:0;
  // Preserve warning/success and category colors. User course colors are untouched inline styles.
  if(sat>.2 && !(b>=g && r>=g*.85 && b>=r*.8))return value;
  const ink=foreground(p.background,p.surface), light=luminance(color);
  const accentInk=Math.min(contrast(p.accent,p.background),contrast(p.accent,p.surface))>=4.5?p.accent:ink;
  let mapped=light<.025?mix(p.background,p.surface,Math.min(1,light/.025)):light<.16?mix(p.surface,ink,.08+(light-.025)*1.2):sat>.2?accentInk:ink;
  if(light<.16&&contrast(ink,mapped)<4.5)mapped=p.surface;
  return mapped+alpha;
}
export function applyAppearance(appearance: Appearance = defaultAppearance): void {
  const p=activePalette(appearance), root=document.documentElement;
  for(const color of themeColors)root.style.setProperty(`--theme-${color.slice(1)}`,appearance.active==='purple'?color:recolor(color,p));
  root.style.setProperty('--profile-bg',p.background);root.style.setProperty('--profile-surface',p.surface);root.style.setProperty('--profile-text',foreground(p.background,p.surface));
  root.style.setProperty('--profile-accent',p.accent);root.style.setProperty('--profile-on-accent',foreground(p.accent));
  root.style.setProperty('--profile-focus',Math.min(contrast(p.accent,p.background),contrast(p.accent,p.surface))>=3?p.accent:foreground(p.background,p.surface));
  const ink=foreground(p.background,p.surface),light=ink==='#000000';
  for(const [key,color]of [['--danger',light?'#9b1c31':'#f1a3b1'],['--green',light?'#176b40':'#a7d6c1']])root.style.setProperty(key,Math.min(contrast(color,p.background),contrast(color,p.surface))>=4.5?color:ink);
  root.style.colorScheme=luminance(p.background)>.179?'light':'dark';root.dataset.appearance=appearance.active;
}
