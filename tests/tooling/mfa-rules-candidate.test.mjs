import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { mfaRulesCandidate } from '../../scripts/mfa-rules-candidate.mjs';

test('MFA staging changes only the reviewed ownership predicate; refuses missing/duplicate predicates', () => {
  const source = fs.readFileSync('cloud/firestore.rules', 'utf8');
  const candidate = mfaRulesCandidate(source);
  const original = source.split('\n').find(line => line.includes('function owns(uid)'));
  const prefix = source.slice(0, source.indexOf(original));
  const suffix = source.slice(source.indexOf(original) + original.length);
  assert.ok(candidate.startsWith(prefix));
  assert.ok(candidate.endsWith(suffix));
  assert.match(candidate, /sign_in_second_factor/);
  assert.throws(() => mfaRulesCandidate(source.replace(original, '')), /Ownership predicate changed/);
  assert.throws(() => mfaRulesCandidate(source + '\n' + original), /Ownership predicate changed/);
  assert.equal(fs.readFileSync('cloud/firestore.rules', 'utf8'), source);
});
