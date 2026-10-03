import { z } from 'zod';
export const MIN_NEW_PASSWORD_LENGTH = 8;
export const MAX_NEW_PASSWORD_LENGTH = 128;
const predictable = new Set(['password', 'password1', 'password123', '12345678', '123456789', 'qwertyui', 'qwerty123', 'qwertyuiop', 'letmein12', 'welcome1', 'welcome123', 'admin123', 'iloveyou', 'cclime123', 'passwordpassword', 'password123456789', '123456789012345', 'qwertyuiopasdfgh', 'letmeinletmeinletmein', 'cc lime password', 'correct horse battery staple']);
export function passwordFeedback(value: string) {
  const length = [...value].length;
  const simple = predictable.has(value.toLowerCase().trim()) || /^(.)\1+$/us.test(value) || /^(.{1,6})\1{2,}$/us.test(value);
  const valid = length >= MIN_NEW_PASSWORD_LENGTH && length <= MAX_NEW_PASSWORD_LENGTH && !simple;
  return { valid, label: !value ? 'Enter a new password' : !valid ? 'Weak' : length >= 24 ? 'Stronger' : length >= 15 ? 'Good' : 'Fair', hint: length > MAX_NEW_PASSWORD_LENGTH ? 'Use no more than 128 characters.' : simple ? 'Avoid common passwords or repeated patterns.' : 'Use at least 8 characters. A longer, unique passphrase is stronger.' };
}
export const newPasswordSchema = z.string().max(512).refine(value => passwordFeedback(value).valid, 'Use a unique password of 8–128 characters; avoid common passwords or repeated patterns.');
export const confirmedPasswordSchema = z.object({ password: newPasswordSchema, confirmation: z.string().max(512) }).strict().refine(value => value.password === value.confirmation, 'The new passwords must match.');
export function validateNewPassword(password: string, confirmation: string): void { confirmedPasswordSchema.parse({ password, confirmation }); }
