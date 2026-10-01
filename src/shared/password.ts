import { z } from 'zod';
const predictable = new Set(['passwordpassword', 'password123456789', '123456789012345', 'qwertyuiopasdfgh', 'letmeinletmeinletmein', 'cc lime password', 'correct horse battery staple']);
export function passwordFeedback(value: string) {
  const length = [...value].length;
  const simple = predictable.has(value.toLowerCase().trim()) || /^(.)\1+$/us.test(value) || /^(.{1,6})\1{2,}$/us.test(value);
  const valid = length >= 15 && length <= 128 && !simple;
  return { valid, label: !value ? 'Enter a new password' : !valid ? 'Weak' : length >= 24 ? 'Stronger' : 'Good', hint: length > 128 ? 'Use no more than 128 characters.' : simple ? 'Avoid common passwords or repeated patterns.' : 'Use at least 15 characters. A long, unique passphrase works well.' };
}
export const newPasswordSchema = z.string().max(512).refine(value => passwordFeedback(value).valid, 'Use a unique password of 15–128 characters; avoid common passwords or repeated patterns.');
export const confirmedPasswordSchema = z.object({ password: newPasswordSchema, confirmation: z.string().max(512) }).strict().refine(value => value.password === value.confirmation, 'The new passwords must match.');
export function validateNewPassword(password: string, confirmation: string): void { confirmedPasswordSchema.parse({ password, confirmation }); }
