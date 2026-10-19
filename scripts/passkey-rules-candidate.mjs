// Staging only. This never edits/deploys production rules or uploads server keys.
export function passkeyRulesCandidate(source) {
  const original='    function owns(uid) { return request.auth != null && request.auth.uid == uid && request.auth.token.email_verified == true; }';
  if(source.split(original).length!==2)throw Error('Ownership predicate changed; review the passkey candidate before proceeding.');
  return source.replace(original, `    // Server-only authSecurity documents are denied to all client reads/writes
    // by the existing default-deny policy. Only the trusted gateway writes them.
    function securityCurrent(uid) {
      let p = /databases/$(database)/documents/authSecurity/$(uid);
      return !exists(p) || (request.auth.token.get('auth_time', 0) is int &&
        request.auth.token.get('auth_time', 0) >= get(p).data.min_auth_time);
    }
    function acceptedAuthentication(uid) {
      let identity = request.auth.token.get('firebase', {});
      let provider = identity.get('sign_in_provider', '');
      let proof = request.auth.token.get('cc_lime_passkey', {});
      let p = /databases/$(database)/documents/authSecurity/$(uid);
      return securityCurrent(uid) && (provider == 'google.com' ||
        (provider == 'password' && identity.get('sign_in_second_factor', '') == 'totp') ||
        (provider == 'custom' && proof.get('v', 0) == 1 && exists(p) &&
          proof.get('epoch', -1) is int && proof.get('epoch', -1) == get(p).data.epoch &&
          proof.get('valid_since', -1) is int && proof.get('valid_since', -1) == get(p).data.valid_since &&
          proof.get('until', 0) is int && proof.get('until', 0) >= request.time.toMillis() / 1000 &&
          proof.get('until', 0) <= request.auth.token.get('auth_time', 0) + 3600));
    }
    function owns(uid) { return request.auth != null && request.auth.uid == uid && request.auth.token.email_verified == true && acceptedAuthentication(uid); }`);
}
