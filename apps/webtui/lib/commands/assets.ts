import { CommandHandler } from './index';
import { apiClient } from '../api-client';

const subsCommand: CommandHandler = async ({ term, args, flags }) => {
  const domain = args[0];
  const all = flags.all !== undefined;

  if (!domain) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :subs <domain> [--all]');
    return;
  }

  term.writeln(`Fetching subdomains for \x1b[1;36m${domain}\x1b[0m...`);

  try {
    const params = new URLSearchParams({ all: all.toString() });
    const response = await apiClient.get(`/assets/${domain}/subs?${params.toString()}`);

    if (response.subdomains.length === 0) {
      term.writeln('');
      term.writeln('No subdomains discovered yet.');
      term.writeln('Run a DNS scan with: \x1b[1;32m:scan passive ' + domain + '\x1b[0m');
      return;
    }

    term.writeln('');
    term.writeln(`Found \x1b[1;33m${response.total}\x1b[0m subdomains`);
    term.writeln('');

    // Group by active status
    const active = response.subdomains.filter((s: any) => s.active);
    const inactive = response.subdomains.filter((s: any) => !s.active);

    if (active.length > 0) {
      term.writeln('\x1b[1;32mActive Subdomains:\x1b[0m');
      term.writeln('─'.repeat(60));
      
      for (const sub of active.slice(0, 20)) {
        const ips = sub.ips?.join(', ') || 'No IPs';
        term.writeln(`  \x1b[1;36m${sub.fqdn}\x1b[0m`);
        term.writeln(`    \x1b[90m${ips}\x1b[0m`);
      }

      if (active.length > 20) {
        term.writeln(`  \x1b[90m... and ${active.length - 20} more\x1b[0m`);
      }

      term.writeln('');
    }

    if (all && inactive.length > 0) {
      term.writeln('\x1b[1;31mInactive Subdomains:\x1b[0m');
      term.writeln('─'.repeat(60));
      
      for (const sub of inactive.slice(0, 10)) {
        term.writeln(`  \x1b[90m${sub.fqdn}\x1b[0m`);
      }

      if (inactive.length > 10) {
        term.writeln(`  \x1b[90m... and ${inactive.length - 10} more\x1b[0m`);
      }

      term.writeln('');
    }

    term.writeln(`Active: \x1b[1;32m${active.length}\x1b[0m | Inactive: \x1b[1;31m${inactive.length}\x1b[0m`);
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

const revipCommand: CommandHandler = async ({ term, args }) => {
  const ip = args[0];

  if (!ip) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing IP address');
    term.writeln('Usage: :revip <ip>');
    return;
  }

  term.writeln(`Performing reverse IP lookup for \x1b[1;36m${ip}\x1b[0m...`);
  term.writeln('');
  term.writeln('\x1b[1;33m⚠ Note:\x1b[0m This feature requires the reverseip worker to be implemented.');
  term.writeln('');

  try {
    // This would call the reverseip worker when implemented
    const response = await apiClient.post('/scan/reverseip', { ip });

    term.writeln(`\x1b[1;32m✓\x1b[0m Reverse IP lookup queued`);
    term.writeln(`Job ID: \x1b[1;33m${response.jobId}\x1b[0m`);
    term.writeln('');
    term.writeln('Results will appear in findings when complete.');
  } catch (error: any) {
    if (error.status === 404) {
      term.writeln('\x1b[1;31m✗ Feature not yet implemented\x1b[0m');
      term.writeln('');
      term.writeln('The reverseip worker is planned but not yet built.');
      term.writeln('See apps/workers/README.md for implementation details.');
    } else {
      term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
    }
  }
};

const whoisCommand: CommandHandler = async ({ term, args }) => {
  const domain = args[0];

  if (!domain) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :whois <domain>');
    return;
  }

  term.writeln(`Fetching WHOIS data for \x1b[1;36m${domain}\x1b[0m...`);
  term.writeln('');
  term.writeln('\x1b[1;33m⚠ Note:\x1b[0m This feature requires the domainwatch worker to be implemented.');
  term.writeln('');

  try {
    const response = await apiClient.post('/scan/whois', { domain });

    term.writeln(`\x1b[1;32m✓\x1b[0m WHOIS lookup queued`);
    term.writeln(`Job ID: \x1b[1;33m${response.jobId}\x1b[0m`);
  } catch (error: any) {
    if (error.status === 404) {
      term.writeln('\x1b[1;31m✗ Feature not yet implemented\x1b[0m');
      term.writeln('');
      term.writeln('The domainwatch worker is planned but not yet built.');
      term.writeln('See apps/workers/README.md for implementation details.');
    } else {
      term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
    }
  }
};

export const assetsCommands = {
  ':subs': {
    name: ':subs',
    description: 'List discovered subdomains',
    usage: ':subs <domain> [--all]',
    handler: subsCommand,
  },
  ':revip': {
    name: ':revip',
    description: 'Reverse IP lookup',
    usage: ':revip <ip>',
    handler: revipCommand,
  },
  ':whois': {
    name: ':whois',
    description: 'WHOIS lookup',
    usage: ':whois <domain>',
    handler: whoisCommand,
  },
};

