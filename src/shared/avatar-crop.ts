import { z } from 'zod';

export const avatarCropSchema = z.object({ zoom: z.number().min(1).max(4), horizontal: z.number().min(0).max(1), vertical: z.number().min(0).max(1) }).strict();
export type AvatarCrop = z.infer<typeof avatarCropSchema>;
export interface AvatarDraft { token: string; preview: string; width: number; height: number; }
export const centeredCrop: AvatarCrop = { zoom: 1, horizontal: 0.5, vertical: 0.5 };
export function avatarCropRectangle(width: number, height: number, value: AvatarCrop) {
  z.number().int().min(1).max(4096).parse(width); z.number().int().min(1).max(4096).parse(height);
  const crop = avatarCropSchema.parse(value), side = Math.max(1, Math.floor(Math.min(width, height) / crop.zoom));
  return { x: Math.round((width - side) * crop.horizontal), y: Math.round((height - side) * crop.vertical), width: side, height: side };
}
