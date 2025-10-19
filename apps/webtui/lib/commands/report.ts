import { CommandHandler } from './index';
import { apiClient, aiClient } from '../api-client';

const reportCommand: CommandHandler = async ({ term, args, flags }) => {
  const domain = args[0];
  const format = (flags.format as string) || 'markdown';

  if (!domain) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :report <domain> [--format=markdown|pdf]');
    return;
  }

  term.writeln(`Generating security report for \x1b[1;36m${domain}\x1b[0m...`);

  try {
    // Fetch findings
    term.writeln('Fetching findings...');
    const findingsResponse = await apiClient.get(`/findings?domain=${domain}`);

    if (findingsResponse.findings.length === 0) {
      term.writeln('');
      term.writeln('\x1b[1;33m⚠ No findings available\x1b[0m');
      term.writeln('Run scans first with: \x1b[1;32m:scan passive ' + domain + '\x1b[0m');
      return;
    }

    // Fetch assets
    term.writeln('Fetching assets...');
    const assetsResponse = await apiClient.get(`/assets/${domain}/subs?all=true`);

    // Generate report with AI
    term.writeln('Generating report with AI...');
    const reportResponse = await aiClient.post('/report', {
      domain,
      findings: findingsResponse.findings,
      assets: assetsResponse.subdomains,
      format,
    });

    term.writeln('');
    term.writeln('\x1b[1;32m✓\x1b[0m Report generated successfully');
    term.writeln('');

    if (format === 'markdown') {
      // Display preview
      const lines = reportResponse.report.split('\n');
      term.writeln('\x1b[1;36m═══════════════════════════════════════\x1b[0m');
      term.writeln('\x1b[1;33m  Report Preview\x1b[0m');
      term.writeln('\x1b[1;36m═══════════════════════════════════════\x1b[0m');
      term.writeln('');
      
      for (const line of lines.slice(0, 30)) {
        term.writeln(line);
      }

      if (lines.length > 30) {
        term.writeln('');
        term.writeln(`\x1b[90m... ${lines.length - 30} more lines\x1b[0m`);
      }

      term.writeln('');
      term.writeln('Download full report? (y/n)');
      
      // Create download
      const blob = new Blob([reportResponse.report], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security-report-${domain}-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);

      term.writeln('\x1b[1;32m✓\x1b[0m Report downloaded');
    } else {
      term.writeln('\x1b[1;33m⚠ PDF generation not yet implemented\x1b[0m');
      term.writeln('Use --format=markdown for now');
    }
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

export const reportCommands = {
  ':report': {
    name: ':report',
    description: 'Generate security report',
    usage: ':report <domain> [--format=markdown|pdf]',
    handler: reportCommand,
  },
};

