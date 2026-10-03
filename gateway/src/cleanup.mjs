// Server cron only. No desktop request can select an account or force its erasure.
export async function reconcileDeletedAccounts(store, identity, now) {
  const result={checked:0,purged:0,pending:0};
  for(const candidate of await store.deletionCandidates()) {
    result.checked++;
    try {
      const user=await identity.lookup(candidate.uid);
      if(user!==null)continue; // Disabled/unverified users still exist; never treat them as deleted.
      const account=await store.markDeleted(candidate.uid,now);
      await identity.publishGate(account.uid,account.epoch,account.min_auth_time,account.valid_since);
      // Keep the raw-token denial gate for 24h, exceeding the maximum 1h passkey assurance.
      if(now-account.deleted_at>=86400000){await identity.eraseGate(account.uid);await store.forgetDeleted(account.uid);result.purged++;}
    }catch{result.pending++;} // Retry hourly. Only aggregate counts may enter operator evidence.
    finally{await store.checked(candidate.uid,now);} // Fair batches also cover former pilot accounts.
  }
  return result;
}
