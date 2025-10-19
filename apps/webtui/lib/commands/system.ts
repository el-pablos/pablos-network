import { CommandHandler } from './index';
import { apiClient } from '../api-client';

const jobsCommand: CommandHandler = async ({ term, flags }) => {
  const status = flags.status as string;

  term.writeln('Fetching jobs...');

  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const response = await apiClient.get(`/jobs?${params.toString()}`);

    if (response.jobs.length === 0) {
      term.writeln('');
      term.writeln('No jobs found.');
      return;
    }

    term.writeln('');
    term.writeln(`\x1b[1;36m${'Job ID'.padEnd(38)} ${'Provider'.padEnd(15)} ${'Status'.padEnd(10)} ${'Progress'}\x1b[0m`);
    term.writeln('─'.repeat(80));

    for (const job of response.jobs) {
      const statusColor = 
        job.status === 'done' ? '\x1b[1;32m' :
        job.status === 'failed' ? '\x1b[1;31m' :
        job.status === 'running' ? '\x1b[1;33m' : '\x1b[1;37m';

      const progressBar = '█'.repeat(Math.floor(job.progress / 5)) + '░'.repeat(20 - Math.floor(job.progress / 5));

      term.writeln(
        `${job.jobId.padEnd(38)} ${job.provider.padEnd(15)} ${statusColor}${job.status.padEnd(10)}\x1b[0m ${progressBar} ${job.progress}%`
      );
    }

    term.writeln('');
    term.writeln(`Total: ${response.jobs.length} jobs`);
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

const jobsCancelCommand: CommandHandler = async ({ term, args }) => {
  const jobId = args[0];

  if (!jobId) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing job ID');
    term.writeln('Usage: :jobs cancel <job-id>');
    return;
  }

  term.writeln(`Cancelling job \x1b[1;36m${jobId}\x1b[0m...`);

  try {
    await apiClient.post(`/jobs/${jobId}/cancel`);

    term.writeln(`\x1b[1;32m✓\x1b[0m Job cancelled`);
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

const jobsHandler: CommandHandler = async (ctx) => {
  const subcommand = ctx.args[0];

  if (subcommand === 'cancel') {
    ctx.args = ctx.args.slice(1);
    await jobsCancelCommand(ctx);
    return;
  }

  await jobsCommand(ctx);
};

const metricsCommand: CommandHandler = async ({ term }) => {
  term.writeln('Fetching system metrics...');

  try {
    const response = await apiClient.get('/metrics');

    term.writeln('');
    term.writeln('\x1b[1;36m═══════════════════════════════════════\x1b[0m');
    term.writeln('\x1b[1;33m  System Metrics\x1b[0m');
    term.writeln('\x1b[1;36m═══════════════════════════════════════\x1b[0m');
    term.writeln('');

    term.writeln('Jobs:');
    term.writeln(`  Running:   \x1b[1;33m${response.jobs.running}\x1b[0m`);
    term.writeln(`  Queued:    \x1b[1;36m${response.jobs.queued}\x1b[0m`);
    term.writeln(`  Completed: \x1b[1;32m${response.jobs.completed}\x1b[0m`);
    term.writeln(`  Failed:    \x1b[1;31m${response.jobs.failed}\x1b[0m`);
    term.writeln('');

    term.writeln('Findings:');
    term.writeln(`  Total:    \x1b[1;33m${response.findings.total}\x1b[0m`);
    term.writeln(`  Critical: \x1b[1;35m${response.findings.critical}\x1b[0m`);
    term.writeln(`  High:     \x1b[1;31m${response.findings.high}\x1b[0m`);
    term.writeln(`  Medium:   \x1b[1;33m${response.findings.medium}\x1b[0m`);
    term.writeln('');

    term.writeln('Assets:');
    term.writeln(`  Domains:    \x1b[1;36m${response.assets.domains}\x1b[0m`);
    term.writeln(`  Subdomains: \x1b[1;36m${response.assets.subdomains}\x1b[0m`);
    term.writeln(`  IPs:        \x1b[1;36m${response.assets.ips}\x1b[0m`);
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

const clearCommand: CommandHandler = async ({ term }) => {
  term.clear();
  
  // Re-display welcome message
  term.writeln('\x1b[1;36m╔═══════════════════════════════════════════════════════════╗\x1b[0m');
  term.writeln('\x1b[1;36m║\x1b[0m  \x1b[1;33mPablos Network\x1b[0m - OSINT & AppSec Orchestrator      \x1b[1;36m║\x1b[0m');
  term.writeln('\x1b[1;36m╚═══════════════════════════════════════════════════════════╝\x1b[0m');
  term.writeln('');
};

export const systemCommands = {
  ':jobs': {
    name: ':jobs',
    description: 'View and manage jobs',
    usage: ':jobs [--status=running|done|failed] | :jobs cancel <job-id>',
    handler: jobsHandler,
  },
  ':metrics': {
    name: ':metrics',
    description: 'View system metrics',
    usage: ':metrics',
    handler: metricsCommand,
  },
  ':clear': {
    name: ':clear',
    description: 'Clear terminal',
    usage: ':clear',
    handler: clearCommand,
  },
};

