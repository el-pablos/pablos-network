import { CommandHandler } from './index';
import { apiClient } from '../api-client';

const findingsList: CommandHandler = async ({ term, args, flags }) => {
  const domain = args[0];
  const severity = flags.severity as string;
  const category = flags.category as string;
  const since = flags.since as string;

  if (!domain) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :findings <domain> [--severity=high|medium|low|info] [--category=WEB|NETWORK|DNS]');
    return;
  }

  term.writeln(`Fetching findings for \x1b[1;36m${domain}\x1b[0m...`);

  try {
    const params = new URLSearchParams({ domain });
    if (severity) params.append('severity', severity);
    if (category) params.append('category', category);
    if (since) params.append('since', since);

    const response = await apiClient.get(`/findings?${params.toString()}`);

    if (response.findings.length === 0) {
      term.writeln('');
      term.writeln('No findings yet.');
      term.writeln('Run a scan with: \x1b[1;32m:scan passive ' + domain + '\x1b[0m');
      return;
    }

    term.writeln('');
    term.writeln(`Found \x1b[1;33m${response.total}\x1b[0m findings`);
    term.writeln('');

    // Group by severity
    const bySeverity: Record<string, any[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };

    for (const finding of response.findings) {
      bySeverity[finding.severity].push(finding);
    }

    // Display findings
    for (const [sev, findings] of Object.entries(bySeverity)) {
      if (findings.length === 0) continue;

      const color = 
        sev === 'critical' ? '\x1b[1;35m' :
        sev === 'high' ? '\x1b[1;31m' :
        sev === 'medium' ? '\x1b[1;33m' :
        sev === 'low' ? '\x1b[1;36m' : '\x1b[1;37m';

      term.writeln(`${color}${sev.toUpperCase()}\x1b[0m (${findings.length})`);
      term.writeln('─'.repeat(60));

      for (const finding of findings.slice(0, 5)) {
        term.writeln(`  ${finding.title}`);
        term.writeln(`    \x1b[90m${finding.provider} | ${finding.category}\x1b[0m`);
      }

      if (findings.length > 5) {
        term.writeln(`  \x1b[90m... and ${findings.length - 5} more\x1b[0m`);
      }

      term.writeln('');
    }

    term.writeln('View details in the Findings panel →');
    term.writeln('Export with: \x1b[1;32m:export ' + domain + '\x1b[0m');
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

const findingsStats: CommandHandler = async ({ term, args }) => {
  const domain = args[0];

  if (!domain) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :findings stats <domain>');
    return;
  }

  term.writeln(`Fetching statistics for \x1b[1;36m${domain}\x1b[0m...`);

  try {
    const response = await apiClient.get(`/findings/stats?domain=${domain}`);

    term.writeln('');
    term.writeln('\x1b[1;36m═══════════════════════════════════════\x1b[0m');
    term.writeln('\x1b[1;33m  Findings Statistics\x1b[0m');
    term.writeln('\x1b[1;36m═══════════════════════════════════════\x1b[0m');
    term.writeln('');

    term.writeln('By Severity:');
    term.writeln(`  \x1b[1;35mCritical:\x1b[0m ${response.bySeverity.critical || 0}`);
    term.writeln(`  \x1b[1;31mHigh:\x1b[0m     ${response.bySeverity.high || 0}`);
    term.writeln(`  \x1b[1;33mMedium:\x1b[0m   ${response.bySeverity.medium || 0}`);
    term.writeln(`  \x1b[1;36mLow:\x1b[0m      ${response.bySeverity.low || 0}`);
    term.writeln(`  \x1b[1;37mInfo:\x1b[0m     ${response.bySeverity.info || 0}`);
    term.writeln('');

    term.writeln('By Category:');
    for (const [category, count] of Object.entries(response.byCategory)) {
      term.writeln(`  ${category}: ${count}`);
    }
    term.writeln('');

    term.writeln('By Provider:');
    for (const [provider, count] of Object.entries(response.byProvider)) {
      term.writeln(`  ${provider}: ${count}`);
    }
    term.writeln('');

    term.writeln(`Total: \x1b[1;33m${response.total}\x1b[0m findings`);
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

const exportFindings: CommandHandler = async ({ term, args, flags }) => {
  const domain = args[0];
  const format = (flags.format as string) || 'json';

  if (!domain) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :export <domain> [--format=json|csv]');
    return;
  }

  term.writeln(`Exporting findings for \x1b[1;36m${domain}\x1b[0m as ${format}...`);

  try {
    const response = await apiClient.get(`/findings?domain=${domain}`);

    if (response.findings.length === 0) {
      term.writeln('');
      term.writeln('No findings to export.');
      return;
    }

    // Create download
    const data = format === 'json'
      ? JSON.stringify(response.findings, null, 2)
      : convertToCSV(response.findings);

    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `findings-${domain}-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);

    term.writeln(`\x1b[1;32m✓\x1b[0m Exported ${response.findings.length} findings`);
    term.writeln(`File: findings-${domain}-${Date.now()}.${format}`);
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

function convertToCSV(findings: any[]): string {
  const headers = ['Title', 'Severity', 'Category', 'Provider', 'Description', 'Target'];
  const rows = findings.map(f => [
    f.title,
    f.severity,
    f.category,
    f.provider,
    f.description,
    f.targetFqdn,
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
}

const findingsHandler: CommandHandler = async (ctx) => {
  const subcommand = ctx.args[0];

  // If first arg looks like a domain, treat as list
  if (subcommand && !['stats'].includes(subcommand)) {
    await findingsList(ctx);
    return;
  }

  if (subcommand === 'stats') {
    ctx.args = ctx.args.slice(1);
    await findingsStats(ctx);
    return;
  }

  ctx.term.writeln('Usage: :findings <domain> [options]');
  ctx.term.writeln('       :findings stats <domain>');
  ctx.term.writeln('');
  ctx.term.writeln('Options:');
  ctx.term.writeln('  --severity=<level>    Filter by severity (critical|high|medium|low|info)');
  ctx.term.writeln('  --category=<cat>      Filter by category (WEB|NETWORK|DNS)');
  ctx.term.writeln('  --since=<time>        Filter by time (e.g., 24h, 7d)');
};

export const findingsCommands = {
  ':findings': {
    name: ':findings',
    description: 'View security findings',
    usage: ':findings <domain> [--severity=high] [--category=WEB]',
    handler: findingsHandler,
  },
  ':export': {
    name: ':export',
    description: 'Export findings to file',
    usage: ':export <domain> [--format=json|csv]',
    handler: exportFindings,
  },
};

