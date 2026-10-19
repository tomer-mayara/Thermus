interface ToolEvidence {
  readonly tool?: string;
  readonly commit?: string;
}

export function toolNoticeOf(base: ToolEvidence, head: ToolEvidence): string[] {
  if (base.tool !== undefined && base.tool === head.tool) return [];
  return [`Tool versions: base ast-metrics ${base.tool ?? 'unknown'}; head ast-metrics ${head.tool ?? 'unknown'}.`, ''];
}

export function trendToolNoticeOf(records: readonly ToolEvidence[]): string[] {
  const versions = [...new Set(records.map(({ tool }) => tool ?? 'unknown'))];
  if (versions.length < 2) return [];
  return ['', `Trend tool versions: ${records.map((record) => `${record.commit?.slice(0, 8) ?? 'this pull request'}: ast-metrics ${record.tool ?? 'unknown'}`).join('; ')}.`];
}
