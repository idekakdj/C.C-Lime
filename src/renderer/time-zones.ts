import { IANAZone } from 'luxon';

// Use the same runtime database that interprets calendar dates. UTC and fixed
// offsets can be absent from primary-zone enumeration. Etc/GMT signs follow IANA
// naming (for example Etc/GMT-14 means UTC+14), so keep their identifiers intact.
const catalog = [...new Set([
  ...Intl.supportedValuesOf('timeZone'), 'UTC', 'Etc/UTC', 'Etc/GMT',
  ...Array.from({ length: 27 }, (_, index) => index - 14)
    .filter(offset => offset !== 0)
    .map(offset => `Etc/GMT${offset > 0 ? '+' : ''}${offset}`),
])].filter(value => IANAZone.isValidZone(value));

export function timeZoneOptions(saved: Array<string | undefined> = []): string[] {
  return [...new Set([...catalog, ...saved.filter((value): value is string => !!value && IANAZone.isValidZone(value))])]
    .sort((a, b) => a === b ? 0 : a === 'UTC' ? -1 : b === 'UTC' ? 1 : a.localeCompare(b));
}
