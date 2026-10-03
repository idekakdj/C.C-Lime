// Staging only: derive from current deployed-rule source, never edit/deploy it.
export function mfaRulesCandidate(source) {
  const original = '    function owns(uid) { return request.auth != null && request.auth.uid == uid && request.auth.token.email_verified == true; }';
  if (source.split(original).length !== 2) throw new Error('Ownership predicate changed; review the MFA candidate before proceeding.');
  return source.replace(original, `    // Required password MFA; Google-only sign-in is outside this policy.
    // These reserved claims come from provider-validated tokens, not user records.
    function acceptedAuthentication() {
      let identity = request.auth.token.get('firebase', {});
      let provider = identity.get('sign_in_provider', '');
      return provider == 'google.com' ||
        (provider == 'password' && identity.get('sign_in_second_factor', '') in ['phone', 'totp']);
    }
    function owns(uid) { return request.auth != null && request.auth.uid == uid && request.auth.token.email_verified == true && acceptedAuthentication(); }`);
}
