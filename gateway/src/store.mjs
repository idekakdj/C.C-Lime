export class D1Store {
  constructor(db) { this.db = db; }
  async takeLimit(bucket, limit, expires, now) {
    const row = await this.db.prepare(`INSERT INTO request_limits(bucket,used,expires_at) VALUES(?,1,?)
      ON CONFLICT(bucket) DO UPDATE SET used=CASE WHEN expires_at<=? THEN 1 ELSE used+1 END,
      expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING used`).bind(bucket,expires,now,now).first();
    if (!row || row.used > limit) throw new Error('LIMIT');
  }
  async account(uid, now, validSince) {
    const handle = randomValue();
    await this.db.prepare('INSERT INTO accounts(uid,user_handle,valid_since) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET valid_since=max(valid_since,excluded.valid_since)').bind(uid,handle,validSince).run();
    const account=await this.db.prepare('SELECT * FROM accounts WHERE uid=?').bind(uid).first();
    if(account.deleted_at!==null||account.valid_since>validSince)throw Error('REVOKED');return account;
  }
  async list(uid) { return (await this.db.prepare('SELECT * FROM credentials WHERE uid=? AND revoked_at IS NULL ORDER BY created_at').bind(uid).all()).results; }
  async credential(id) { return this.db.prepare('SELECT c.*,a.user_handle FROM credentials c JOIN accounts a ON a.uid=c.uid WHERE c.id=? AND c.revoked_at IS NULL').bind(id).first(); }
  async flow(ticket) { return this.db.prepare('SELECT * FROM flows WHERE ticket=?').bind(ticket).first(); }
  async createFlow(flow) {
    await this.db.prepare(`INSERT INTO flows(ticket,operation,proof_hash,redirect,state,uid,auth_time,valid_since,label,challenge,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(flow.ticket,flow.operation,flow.proof_hash,flow.redirect,flow.state,flow.uid,flow.auth_time,flow.valid_since,flow.label,flow.challenge,flow.expires_at).run();
  }
  // Claim BEFORE verification. Failure burns the challenge; a retry needs a new ceremony.
  async claim(ticket, now) { return this.db.prepare("UPDATE flows SET status='verifying' WHERE ticket=? AND status='pending' AND expires_at>? RETURNING *").bind(ticket,now).first(); }
  async register(flow, credential, code, now) {
    // Count bound and unique ID are enforced atomically by the write, including concurrent registrations.
    const inserted = await this.db.prepare(`INSERT INTO credentials(id,uid,public_key,counter,device_type,backed_up,label,created_at)
      SELECT ?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM credentials WHERE uid=? AND revoked_at IS NULL)<5 RETURNING id`)
      .bind(credential.id,flow.uid,credential.public_key,credential.counter,credential.device_type,credential.backed_up,flow.label,now,flow.uid).first();
    if (!inserted) throw Error('CAPACITY');
    await this.complete(flow.ticket,flow.uid,credential.id,code,now);
  }
  async authenticate(flow, credential, info, code, now) {
    // Revision guards zero-counter and synced passkeys too, not just incrementing hardware counters.
    const row = await this.db.prepare(`UPDATE credentials SET counter=?,backed_up=?,revision=revision+1,last_used_at=?
      WHERE id=? AND uid=? AND revision=? AND revoked_at IS NULL RETURNING id`)
      .bind(info.newCounter,Number(info.credentialBackedUp),now,credential.id,credential.uid,credential.revision).first();
    if (!row) throw Error('CREDENTIAL_CHANGED');
    await this.complete(flow.ticket,credential.uid,credential.id,code,now);
  }
  async complete(ticket, uid, credential, code, now) {
    const row = await this.db.prepare("UPDATE flows SET uid=?,credential_id=?,completion_code=?,completed_at=?,status='complete' WHERE ticket=? AND status='verifying' AND expires_at>? RETURNING ticket")
      .bind(uid,credential,code,now,ticket,now).first();
    if (!row) throw Error('FLOW_ENDED');
  }
  async rotate(uid, expectedEpoch, minAuthTime) {
    const account = await this.db.prepare('UPDATE accounts SET epoch=epoch+1,min_auth_time=max(min_auth_time,?) WHERE uid=? AND epoch=? RETURNING *').bind(minAuthTime,uid,expectedEpoch).first();
    if (!account) throw Error('ACCOUNT_CHANGED'); return account;
  }
  async remove(uid, id, hasTotp, now) {
    const removed = await this.db.prepare(`UPDATE credentials SET revoked_at=?,revision=revision+1 WHERE id=? AND uid=? AND revoked_at IS NULL
      AND (?=1 OR (SELECT count(*) FROM credentials WHERE uid=? AND revoked_at IS NULL)>1) RETURNING id`).bind(now,id,uid,Number(hasTotp),uid).first();
    if (!removed) throw Error('LAST_FACTOR_OR_UNKNOWN');
  }
  async consume(ticket, code, proofHash, now) {
    return this.db.prepare("UPDATE flows SET status='consumed' WHERE ticket=? AND completion_code=? AND proof_hash=? AND status='complete' AND expires_at>? RETURNING *").bind(ticket,code,proofHash,now).first();
  }
  async cleanup(now) { await this.db.batch([this.db.prepare('DELETE FROM flows WHERE expires_at<=?').bind(now),this.db.prepare('DELETE FROM request_limits WHERE expires_at<=?').bind(now)]); }
  async deletionCandidates() { return (await this.db.prepare('SELECT * FROM accounts ORDER BY last_checked_at,uid LIMIT 20').bind().all()).results; }
  async checked(uid,now) { await this.db.prepare('UPDATE accounts SET last_checked_at=? WHERE uid=?').bind(now,uid).run(); }
  async markDeleted(uid, now) {
    // D1 batch is transactional. Keep only a bounded-lived server tombstone for gate cleanup retries.
    await this.db.batch([
      this.db.prepare('UPDATE accounts SET deleted_at=coalesce(deleted_at,?),epoch=CASE WHEN deleted_at IS NULL THEN epoch+1 ELSE epoch END,min_auth_time=max(min_auth_time,?) WHERE uid=?').bind(now,Math.floor(now/1000)+1,uid),
      this.db.prepare('DELETE FROM flows WHERE uid=?').bind(uid),
      this.db.prepare('DELETE FROM credentials WHERE uid=?').bind(uid),
    ]);
    return this.db.prepare('SELECT * FROM accounts WHERE uid=?').bind(uid).first();
  }
  async forgetDeleted(uid) { await this.db.prepare('DELETE FROM accounts WHERE uid=? AND deleted_at IS NOT NULL').bind(uid).run(); }
}
export function randomValue() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return encode(bytes); }
export function encode(bytes) { let binary=''; for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
export function decode(value) { if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value)||value.length>16384)throw Error('ENCODING');return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)); }
export async function hash(value) { return encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))); }
