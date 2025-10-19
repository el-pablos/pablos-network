import { CommandHandler } from './index';
import { apiClient, aiClient } from '../api-client';

const scanPassive: CommandHandler = async ({ term, args }) => {
  if (args.length === 0) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :scan passive <domain>');
    return;
  }

  const domain = args[0];

  term.writeln(`Starting passive OSINT scan on \x1b[1;36m${domain}\x1b[0m...`);

  try {
    const response = await apiClient.post('/scan/passive', { domain });

    term.writeln(`\x1b[1;32m✓\x1b[0m Scan jobs queued`);
    term.writeln('');
    term.writeln('Job IDs:');
    
    for (const job of response.jobs) {
      term.writeln(`  \x1b[1;33m${job.jobId}\x1b[0m - ${job.provider}`);
    }

    term.writeln('');
    term.writeln('Watch progress in the Jobs panel →');
    term.writeln('View findings with: \x1b[1;32m:findings ' + domain + '\x1b[0m');
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

const scanWeb: CommandHandler = async ({ term, args, flags }) => {
  if (args.length === 0) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :scan web <domain> [--mode=safe|aggressive] [--include=dirsearch]');
    return;
  }

  const domain = args[0];
  const mode = (flags.mode as string) || 'safe';
  const include = (flags.include as string)?.split(',') || ['dirsearch'];

  term.writeln(`Starting web discovery scan on \x1b[1;36m${domain}\x1b[0m...`);
  term.writeln(`Mode: \x1b[1;33m${mode}\x1b[0m`);

  try {
    const response = await apiClient.post('/scan/web', {
      domain,
      mode,
      include,
    });

    term.writeln(`\x1b[1;32m✓\x1b[0m Scan jobs queued`);
    term.writeln('');
    term.writeln('Job IDs:');
    
    for (const job of response.jobs) {
      term.writeln(`  \x1b[1;33m${job.jobId}\x1b[0m - ${job.provider}`);
    }

    term.writeln('');
    term.writeln('\x1b[1;33m⚠ Note:\x1b[0m Active scans require domain verification');
    term.writeln('Verify with: \x1b[1;32m:scope verify ' + domain + '\x1b[0m');
  } catch (error: any) {
    if (error.status === 403) {
      term.writeln(`\x1b[1;31m✗ Verification required\x1b[0m`);
      term.writeln('');
      term.writeln('Active scans require proof of ownership.');
      term.writeln('Run: \x1b[1;32m:scope verify ' + domain + '\x1b[0m');
    } else {
      term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
    }
  }
};

const scanDast: CommandHandler = async ({ term, args, flags }) => {
  if (args.length === 0) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :scan dast <domain> [--safe]');
    return;
  }

  const domain = args[0];
  const safe = flags.safe !== false;

  term.writeln(`Starting DAST scan on \x1b[1;36m${domain}\x1b[0m...`);
  term.writeln(`Mode: \x1b[1;33m${safe ? 'safe (baseline only)' : 'full'}\x1b[0m`);

  try {
    const response = await apiClient.post('/scan/dast', {
      domain,
      mode: safe ? 'safe' : 'full',
    });

    term.writeln(`\x1b[1;32m✓\x1b[0m DAST scan queued`);
    term.writeln('');
    term.writeln(`Job ID: \x1b[1;33m${response.jobId}\x1b[0m`);
    term.writeln('');
    term.writeln('\x1b[1;33m⚠ Note:\x1b[0m DAST scans require domain verification');
    term.writeln('This may take several minutes to complete.');
  } catch (error: any) {
    if (error.status === 403) {
      term.writeln(`\x1b[1;31m✗ Verification required\x1b[0m`);
      term.writeln('');
      term.writeln('DAST scans require proof of ownership.');
      term.writeln('Run: \x1b[1;32m:scope verify ' + domain + '\x1b[0m');
    } else {
      term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
    }
  }
};

const scanFull: CommandHandler = async ({ term, args }) => {
  if (args.length === 0) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :scan full <domain>');
    return;
  }

  const domain = args[0];

  term.writeln(`Planning comprehensive scan for \x1b[1;36m${domain}\x1b[0m...`);
  term.writeln('Using AI to generate optimal scan plan...');

  try {
    // Get AI-generated plan
    const planResponse = await aiClient.post('/plan', {
      command: `comprehensive security assessment of ${domain}`,
      constraints: {
        maxDuration: 3600,
        safeMode: true,
      },
    });

    term.writeln('');
    term.writeln('\x1b[1;32m✓\x1b[0m Scan plan generated');
    term.writeln('');
    term.writeln('Planned steps:');
    
    for (const step of planResponse.steps) {
      term.writeln(`  ${step.order}. \x1b[1;36m${step.provider}\x1b[0m - ${step.description}`);
    }

    term.writeln('');
    term.writeln('Executing scan plan...');

    // Execute each step
    for (const step of planResponse.steps) {
      const endpoint = step.provider === 'dns' || step.provider === 'zoomEye' || step.provider === 'binaryEdge'
        ? '/scan/passive'
        : step.provider === 'dirsearch'
        ? '/scan/web'
        : '/scan/dast';

      await apiClient.post(endpoint, {
        domain,
        mode: 'safe',
        include: [step.provider],
      });

      term.writeln(`  \x1b[1;32m✓\x1b[0m ${step.provider} queued`);
    }

    term.writeln('');
    term.writeln('\x1b[1;32m✓\x1b[0m All scans queued successfully');
    term.writeln('');
    term.writeln('Monitor progress in the Jobs panel →');
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

const scanHandler: CommandHandler = async (ctx) => {
  const subcommand = ctx.args[0];

  if (!subcommand) {
    ctx.term.writeln('Usage: :scan <passive|web|dast|full> <domain> [options]');
    ctx.term.writeln('');
    ctx.term.writeln('Subcommands:');
    ctx.term.writeln('  passive <domain>              Passive OSINT reconnaissance');
    ctx.term.writeln('  web <domain> [--mode=safe]    Web discovery (requires verification)');
    ctx.term.writeln('  dast <domain> [--safe]        DAST scan (requires verification)');
    ctx.term.writeln('  full <domain>                 AI-planned comprehensive scan');
    return;
  }

  const handlers: Record<string, CommandHandler> = {
    passive: scanPassive,
    web: scanWeb,
    dast: scanDast,
    full: scanFull,
  };

  const handler = handlers[subcommand];
  
  if (!handler) {
    ctx.term.writeln(`\x1b[1;31mUnknown scan type:\x1b[0m ${subcommand}`);
    return;
  }

  ctx.args = ctx.args.slice(1);
  await handler(ctx);
};

export const scanCommands = {
  ':scan': {
    name: ':scan',
    description: 'Run security scans',
    usage: ':scan <passive|web|dast|full> <domain> [options]',
    handler: scanHandler,
  },
};

