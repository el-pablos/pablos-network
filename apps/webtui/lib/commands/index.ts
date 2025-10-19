import { Terminal } from 'xterm';
import { scopeCommands } from './scope';
import { scanCommands } from './scan';
import { findingsCommands } from './findings';
import { assetsCommands } from './assets';
import { reportCommands } from './report';
import { systemCommands } from './system';

export interface CommandContext {
  term: Terminal;
  args: string[];
  flags: Record<string, string | boolean>;
}

export type CommandHandler = (ctx: CommandContext) => Promise<void>;

interface Command {
  name: string;
  description: string;
  usage: string;
  handler: CommandHandler;
}

const commands: Record<string, Command> = {
  ...scopeCommands,
  ...scanCommands,
  ...findingsCommands,
  ...assetsCommands,
  ...reportCommands,
  ...systemCommands,
};

function parseCommand(input: string): { command: string; args: string[]; flags: Record<string, string | boolean> } {
  const parts = input.trim().split(/\s+/);
  const command = parts[0];
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    
    if (part.startsWith('--')) {
      // Long flag
      const [key, value] = part.slice(2).split('=');
      flags[key] = value || true;
    } else if (part.startsWith('-')) {
      // Short flag
      flags[part.slice(1)] = true;
    } else {
      // Argument
      args.push(part);
    }
  }

  return { command, args, flags };
}

export async function executeCommand(input: string, term: Terminal): Promise<void> {
  const { command, args, flags } = parseCommand(input);

  // Handle empty command
  if (!command) {
    return;
  }

  // Handle help
  if (command === ':help' || command === 'help') {
    showHelp(term);
    return;
  }

  // Find and execute command
  const cmd = commands[command];
  
  if (!cmd) {
    term.writeln(`\x1b[1;31mUnknown command:\x1b[0m ${command}`);
    term.writeln(`Type \x1b[1;32m:help\x1b[0m for available commands`);
    return;
  }

  try {
    await cmd.handler({ term, args, flags });
  } catch (error: any) {
    term.writeln(`\x1b[1;31mError:\x1b[0m ${error.message}`);
  }
}

function showHelp(term: Terminal) {
  term.writeln('');
  term.writeln('\x1b[1;36m═══════════════════════════════════════════════════════════\x1b[0m');
  term.writeln('\x1b[1;33m  Pablos Network - Available Commands\x1b[0m');
  term.writeln('\x1b[1;36m═══════════════════════════════════════════════════════════\x1b[0m');
  term.writeln('');

  const categories = {
    'Scope Management': [':scope'],
    'Scanning': [':scan'],
    'Assets': [':subs', ':revip'],
    'Findings': [':findings', ':export'],
    'Reporting': [':report'],
    'System': [':jobs', ':metrics', ':clear', ':help'],
  };

  for (const [category, cmdNames] of Object.entries(categories)) {
    term.writeln(`\x1b[1;35m${category}:\x1b[0m`);
    
    for (const cmdName of cmdNames) {
      const cmd = commands[cmdName];
      if (cmd) {
        term.writeln(`  \x1b[1;32m${cmd.name.padEnd(20)}\x1b[0m ${cmd.description}`);
        term.writeln(`    \x1b[90m${cmd.usage}\x1b[0m`);
      }
    }
    
    term.writeln('');
  }

  term.writeln('\x1b[1;36m═══════════════════════════════════════════════════════════\x1b[0m');
  term.writeln('');
  term.writeln('Keyboard shortcuts:');
  term.writeln('  \x1b[1;32mCtrl+K\x1b[0m       Command palette');
  term.writeln('  \x1b[1;32mCtrl+L\x1b[0m       Clear terminal');
  term.writeln('  \x1b[1;32mCtrl+C\x1b[0m       Cancel current command');
  term.writeln('  \x1b[1;32m↑/↓\x1b[0m          Navigate command history');
  term.writeln('');
}

export function getCommands(): Command[] {
  return Object.values(commands);
}

