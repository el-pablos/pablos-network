import { CommandHandler } from './index';
import { apiClient } from '../api-client';

const scopeAdd: CommandHandler = async ({ term, args, flags }) => {
  if (args.length === 0) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :scope add <domain> [--verify=dns|http]');
    return;
  }

  const domain = args[0];
  const verify = (flags.verify as string) || 'dns';

  term.writeln(`Adding \x1b[1;36m${domain}\x1b[0m to scope...`);

  try {
    const response = await apiClient.post('/scope', {
      type: 'domain',
      fqdn: domain,
      verify,
    });

    term.writeln(`\x1b[1;32m✓\x1b[0m Domain added successfully`);
    term.writeln('');
    term.writeln(`Asset ID: \x1b[1;33m${response.asset.id}\x1b[0m`);
    term.writeln('');
    
    if (response.verification) {
      term.writeln('\x1b[1;33m⚠ Verification required for active scans:\x1b[0m');
      term.writeln('');
      
      if (verify === 'dns') {
        term.writeln('Add this DNS TXT record:');
        term.writeln(`  \x1b[1;36m${response.verification.record}\x1b[0m`);
      } else {
        term.writeln('Create this file:');
        term.writeln(`  \x1b[1;36m${response.verification.path}\x1b[0m`);
        term.writeln('With content:');
        term.writeln(`  \x1b[1;36m${response.verification.content}\x1b[0m`);
      }
      
      term.writeln('');
      term.writeln('Then run:');
      term.writeln(`  \x1b[1;32m:scope verify ${domain}\x1b[0m`);
    }
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

const scopeVerify: CommandHandler = async ({ term, args }) => {
  if (args.length === 0) {
    term.writeln('\x1b[1;31mError:\x1b[0m Missing domain');
    term.writeln('Usage: :scope verify <domain>');
    return;
  }

  const domain = args[0];

  term.writeln(`Verifying ownership of \x1b[1;36m${domain}\x1b[0m...`);

  try {
    const response = await apiClient.post('/scope/verify', {
      domain,
      method: 'dns', // Try DNS first
    });

    if (response.verified) {
      term.writeln(`\x1b[1;32m✓ Verification successful!\x1b[0m`);
      term.writeln('');
      term.writeln('You can now run active scans on this domain.');
    } else {
      term.writeln(`\x1b[1;31m✗ Verification failed\x1b[0m`);
      term.writeln('');
      term.writeln('Make sure the verification record is set correctly.');
    }
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

const scopeList: CommandHandler = async ({ term }) => {
  term.writeln('Fetching assets in scope...');

  try {
    const response = await apiClient.get('/scope');

    if (response.assets.length === 0) {
      term.writeln('');
      term.writeln('No assets in scope yet.');
      term.writeln('Add one with: \x1b[1;32m:scope add <domain>\x1b[0m');
      return;
    }

    term.writeln('');
    term.writeln(`\x1b[1;36m${'Domain'.padEnd(30)} ${'Type'.padEnd(10)} ${'Verified'.padEnd(10)} ${'Added'}\x1b[0m`);
    term.writeln('─'.repeat(70));

    for (const asset of response.assets) {
      const verified = asset.verifiedAt ? '\x1b[1;32m✓\x1b[0m' : '\x1b[1;31m✗\x1b[0m';
      const date = new Date(asset.createdAt).toLocaleDateString();
      
      term.writeln(
        `${asset.fqdn.padEnd(30)} ${asset.type.padEnd(10)} ${verified.padEnd(10)} ${date}`
      );
    }

    term.writeln('');
    term.writeln(`Total: ${response.assets.length} assets`);
  } catch (error: any) {
    term.writeln(`\x1b[1;31m✗ Failed:\x1b[0m ${error.message}`);
  }
};

const scopeHandler: CommandHandler = async (ctx) => {
  const subcommand = ctx.args[0];

  if (!subcommand) {
    ctx.term.writeln('Usage: :scope <add|verify|list> [args]');
    ctx.term.writeln('');
    ctx.term.writeln('Subcommands:');
    ctx.term.writeln('  add <domain>     Add domain to scope');
    ctx.term.writeln('  verify <domain>  Verify domain ownership');
    ctx.term.writeln('  list             List all assets in scope');
    return;
  }

  const handlers: Record<string, CommandHandler> = {
    add: scopeAdd,
    verify: scopeVerify,
    list: scopeList,
  };

  const handler = handlers[subcommand];
  
  if (!handler) {
    ctx.term.writeln(`\x1b[1;31mUnknown subcommand:\x1b[0m ${subcommand}`);
    return;
  }

  // Remove subcommand from args
  ctx.args = ctx.args.slice(1);
  await handler(ctx);
};

export const scopeCommands = {
  ':scope': {
    name: ':scope',
    description: 'Manage assets in scope',
    usage: ':scope <add|verify|list> [args]',
    handler: scopeHandler,
  },
};

