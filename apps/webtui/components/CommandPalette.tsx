'use client';

import { useCommandPalette } from '@/hooks/useCommandPalette';
import { getCommands } from '@/lib/commands';
import { useEffect, useState } from 'react';

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = getCommands();

  // Filter commands based on search
  const filteredCommands = commands.filter((cmd) => {
    const searchLower = search.toLowerCase();
    return (
      cmd.name.toLowerCase().includes(searchLower) ||
      cmd.description.toLowerCase().includes(searchLower) ||
      cmd.usage.toLowerCase().includes(searchLower)
    );
  });

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          // Copy command to clipboard
          navigator.clipboard.writeText(selected.name);
          close();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close, filteredCommands, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-32"
      onClick={close}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="p-4 border-b border-gray-700">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commands..."
            className="w-full bg-gray-800 text-gray-100 px-4 py-2 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
            autoFocus
          />
        </div>

        {/* Commands list */}
        <div className="max-h-96 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.name}
                className={`p-4 border-b border-gray-800 cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-900/30 border-blue-700'
                    : 'hover:bg-gray-800'
                }`}
                onClick={() => {
                  navigator.clipboard.writeText(cmd.name);
                  close();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-gray-100 font-medium mb-1">
                      {cmd.name}
                    </h3>
                    <p className="text-sm text-gray-400 mb-2">
                      {cmd.description}
                    </p>
                    <code className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                      {cmd.usage}
                    </code>
                  </div>
                  {index === selectedIndex && (
                    <span className="text-xs text-blue-400 ml-4">↵</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
          <div className="flex gap-4">
            <span>
              <kbd className="px-2 py-1 bg-gray-800 rounded">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-2 py-1 bg-gray-800 rounded">↵</kbd> Copy
            </span>
            <span>
              <kbd className="px-2 py-1 bg-gray-800 rounded">Esc</kbd> Close
            </span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </div>
  );
}

