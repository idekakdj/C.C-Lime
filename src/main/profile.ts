import { createHash } from 'node:crypto';
import { isTask, type DomainRecord, type LifetimeCompletion } from '../shared/model';

export function completionFor(value: DomainRecord, lookup: (id: string) => DomainRecord | null): LifetimeCompletion | null {
  const item = value.kind === 'item' ? value : value.kind === 'occurrenceState' ? lookup(value.seriesId) : null;
  if (item?.kind !== 'item' || !isTask(item) || !('status' in value) || value.status !== 'completed' || value.kind === 'item' && value.recurrence) return null;
  const originalDate = value.kind === 'occurrenceState' ? value.originalDate : null;
  const hash = createHash('sha256').update(`cc-lime:lifetime:${item.id}:${originalDate ?? ''}`).digest('hex');
  const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
  return { id, kind: 'completion', taskId: item.id, originalDate, completedAt: value.completedAt ?? new Date().toISOString() };
}
