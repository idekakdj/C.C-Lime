import type { Snapshot, SnapshotUpdate } from '../shared/model';

export function mergeSnapshot(previous:Snapshot|null,next:SnapshotUpdate):Snapshot{
  const same=!!previous?.recordsRevision&&previous.recordsRevision===next.recordsRevision&&previous.session?.uid===next.session?.uid&&previous.localMode===next.localMode;
  if(next.records===undefined&&!same)throw new Error('Your calendar needs to be reloaded. Reopen the app to try again.');
  return {...next,records:same?previous!.records:next.records!};
}
