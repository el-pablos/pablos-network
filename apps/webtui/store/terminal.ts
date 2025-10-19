import { create } from 'zustand';

interface TerminalState {
  history: string[];
  addToHistory: (command: string) => void;
  clearHistory: () => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  history: [],
  
  addToHistory: (command: string) =>
    set((state) => ({
      history: [...state.history, command].slice(-100), // Keep last 100 commands
    })),
  
  clearHistory: () => set({ history: [] }),
}));

