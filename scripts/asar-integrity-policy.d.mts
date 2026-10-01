export interface EmbeddedAsarIntegrity {file: string; algorithm: string; headerSha256: string;}
export function readEmbeddedAsarIntegrity(bytes: Buffer): EmbeddedAsarIntegrity;
export function inspectAsarIntegrity(bytes: Buffer, archive: string): EmbeddedAsarIntegrity & {headerMatches: boolean; scope: string};
