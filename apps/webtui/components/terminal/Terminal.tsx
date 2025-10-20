'use client';

import { useEffect, useRef } from 'react';
import { CommandParser } from './CommandParser';
import { useTerminalStore } from '@/store/terminal';

export function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const commandParserRef = useRef<CommandParser | null>(null);
  const { addToHistory } = useTerminalStore();

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    // Dynamically import xterm to avoid SSR issues
    const initTerminal = async () => {
      const { Terminal: XTerm } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');
      const { WebLinksAddon } = await import('xterm-addon-web-links');

      // Initialize xterm
      const term = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
        theme: {
          background: '#0a0e14',
          foreground: '#b3b1ad',
          cursor: '#ffcc66',
          selectionBackground: '#253340',
          black: '#01060e',
          red: '#ea6c73',
          green: '#91b362',
          yellow: '#f9af4f',
          blue: '#53bdfa',
          magenta: '#fae994',
          cyan: '#90e1c6',
          white: '#c7c7c7',
          brightBlack: '#686868',
          brightRed: '#f07178',
          brightGreen: '#c2d94c',
          brightYellow: '#ffb454',
          brightBlue: '#59c2ff',
          brightMagenta: '#ffee99',
          brightCyan: '#95e6cb',
          brightWhite: '#ffffff',
        },
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);

      term.open(terminalRef.current!);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Initialize command parser
      const parser = new CommandParser(term, addToHistory);
      commandParserRef.current = parser;

      // Welcome message
      term.writeln('\x1b[1;36m╔═══════════════════════════════════════════════════════════╗\x1b[0m');
      term.writeln('\x1b[1;36m║\x1b[0m  \x1b[1;33mPablos Network\x1b[0m - OSINT & AppSec Orchestrator      \x1b[1;36m║\x1b[0m');
      term.writeln('\x1b[1;36m╚═══════════════════════════════════════════════════════════╝\x1b[0m');
      term.writeln('');
      term.writeln('Type \x1b[1;32m:help\x1b[0m for available commands or press \x1b[1;32mCtrl+K\x1b[0m for command palette');
      term.writeln('');

      parser.prompt();

      // Handle resize
      const handleResize = () => {
        fitAddon.fit();
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        term.dispose();
      };
    };

    initTerminal();
  }, [addToHistory]);

  return (
    <div className="h-full w-full bg-terminal-bg p-4">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
}

