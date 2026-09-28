// A missing, stale-format or failed audit must never turn into a clean report.
export function assessAudit(report) {
  const levels = ['info', 'low', 'moderate', 'high', 'critical'];
  if (!report || report.error || report.auditReportVersion !== 2 ||
      !report.vulnerabilities || Array.isArray(report.vulnerabilities) ||
      typeof report.vulnerabilities !== 'object' || !report.metadata?.vulnerabilities) {
    throw new Error('Dependency audit is missing or unsupported; release status is unknown.');
  }
  const counts = Object.fromEntries(levels.map(level => [level, 0]));
  const findings = Object.entries(report.vulnerabilities).map(([name, value]) => {
    if (!value || !levels.includes(value.severity)) throw new Error('Unrecognized dependency severity.');
    counts[value.severity]++;
    return { name, severity: value.severity };
  }).sort((a, b) => a.name.localeCompare(b.name));
  counts.total = findings.length;
  for (const [key, count] of Object.entries(counts)) {
    if (report.metadata.vulnerabilities[key] !== count) throw new Error('Dependency audit counts are inconsistent.');
  }
  // Deliberately conservative: devDependencies include bundled app code.
  // No severity suppression or claim that omit=dev represents the shipped app.
  return { counts, findings, releaseAllowed: counts.total === 0 };
}
