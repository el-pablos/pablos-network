'use client';

import dynamic from 'next/dynamic';
import { JobsPanel } from '@/components/panels/JobsPanel';
import { FindingsPanel } from '@/components/panels/FindingsPanel';
import { CommandPalette } from '@/components/CommandPalette';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { useEffect } from 'react';

// Dynamically import Terminal component with SSR disabled
const Terminal = dynamic(() => import('@/components/terminal/Terminal').then(mod => ({ default: mod.Terminal })), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-terminal-bg p-4 flex items-center justify-center text-gray-400">Loading terminal...</div>
});

export default function Home() {
  const { isOpen, open, close } = useCommandPalette();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <main className="flex h-screen bg-gray-900 text-gray-100">
      {/* Left sidebar - Terminal */}
      <div className="flex-1 flex flex-col border-r border-gray-700">
        <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            Pablos Network
          </h1>
          <p className="text-sm text-gray-400">OSINT & AppSec Orchestrator</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <Terminal />
        </div>
      </div>

      {/* Right sidebar - Panels */}
      <div className="w-96 flex flex-col bg-gray-800">
        <div className="flex-1 overflow-hidden border-b border-gray-700">
          <JobsPanel />
        </div>
        <div className="flex-1 overflow-hidden">
          <FindingsPanel />
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette />
    </main>
  );
}

