# Windows signing decision and implementation gate

Prepared September 28, 2026 for T-46/T-58. Current installers are unsigned, local owner previews. No account, subscription, certificate, signing permission or billing change has been created. This is a concrete proposal for a later owner decision.

## Candidate for the existing installer

For continued direct EXE distribution by a Canadian individual or eligible company, evaluate **Azure Artifact Signing, Basic, Public Trust**. Microsoft's current setup documentation permits individual developers in Canada and requires an Azure subscription, identity validation and certificate profile. Individual validation uses matching legal-name/address and government-ID information; Microsoft says those billing identity details appear on the public certificate profile. The owner must review that disclosure and complete identity proof privately through the provider, never by sending ID or billing information to this repository or chat. [Microsoft setup requirements](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart).

Microsoft lists Basic at **$9.99 per account per month**, including **5,000 signatures**, with **$0.005 per additional signature**. These are published reference prices, not a Canadian-dollar quote or an approved spending limit; confirm currency, taxes, exchange rate, support charges and actual subscription pricing before purchase. Proposed scope is one Basic account/profile for approved releases only. Routine PR/test builds must remain unable to consume signing quota. [SKU and quota table](https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-change-sku).

Signing identifies the publisher and protects artifact integrity; it does not guarantee that a new download avoids SmartScreen warnings. Microsoft's Store MSIX route provides Store-managed signing but would require separate packaging/distribution work; the existing Squirrel EXE is not automatically re-signed by that route. A conventional CA certificate is another option if the eventual organization has different requirements. [Microsoft distribution/signing comparison](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options).

## Decisions required before provider setup

| Decision | Concrete choice to record |
| --- | --- |
| Public publisher identity | Individual legal identity or the final legal company; approve certificate-visible details. The product name and GitHub username are not substitutes for verified identity. |
| Distribution | Keep the current owner-only unsigned preview for now, or prepare direct signed EXE distribution. A Store/MSIX path is a separate scope decision. |
| Cost and account | Approve the actual quote/subscription, account owner, limit/escalation behavior and cancellation responsibility. Billing alerts alone must not be described as a guaranteed spending cap. |
| Access and recovery | Name identity verifier, restricted release signer, reviewer and recovery custodian; approve admin MFA/recovery and release-branch protections before issuing signing access. |
| Provider/privacy | Review vendor terms, permitted processing region and identity-data handling; approve the provider for the actual operator. |

Identity-verification and certificate-profile signing are separate provider roles; grant each only where required. [Microsoft role model](https://learn.microsoft.com/en-us/azure/artifact-signing/concept-resources-roles). Actual assignments and negative access tests remain pending.

## Implementation and acceptance after those decisions

1. Capture the approved identity/profile/subscription references privately. Establish scoped authentication with a recovery path; no long-lived signing credential in source, PR builds, renderer or calendar backups.
2. Confirm the pinned Forge/packager and Squirrel signing interfaces against the selected provider's current client tooling. Both installed local type definitions expose `windowsSign`; actual signing integration is untested. Prototype on an isolated release branch with a non-distributed fixture before altering the production path.
3. Sign the required application and installer artifacts in the correct packaging order, using reviewed digest/timestamp settings. Verify publisher identity, trust chain, timestamp and expected signatures. Fail closed on missing credentials, wrong profile, signing/network failure or invalid verification; never silently distribute an unsigned fallback as a signed release.
4. Test rejected access from an ordinary PR job and an unauthorized principal, then an approved signing operation. Record the signed artifact hashes separately: the unsigned 0.1.8 hashes cannot identify newly signed bytes. Regenerate package metadata after signing where required by the installer format.
5. Exercise clean installation, populated upgrade, notifications/startup, uninstall/reinstall, tampered-copy signature rejection and release verification on a separate Windows PC. Confirm timestamps and expired/revoked credential handling without changing system time or revoking a production credential merely for a test.
6. Document operational quota monitoring, renewal/revalidation, revocation/compromise response, recovery custody and release approval. Publish only through the approved channel after the other acceptance gates pass.

Until these gates are met, the current signed-distribution task remains open. See [access controls](ACCESS_GOVERNANCE.md), [incident response](INCIDENT_CONTINUITY.md) and [release evidence](IMPLEMENTATION_STATUS.md). No signing service has been purchased or enabled by this proposal.
