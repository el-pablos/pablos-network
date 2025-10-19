import { create } from 'zustand';

export interface Finding {
  id: string;
  targetFqdn: string;
  provider: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  createdAt: string;
  metadata?: any;
}

interface FindingsState {
  findings: Finding[];
  filter: {
    severity?: string;
    category?: string;
  };
  addFinding: (finding: Finding) => void;
  setFindings: (findings: Finding[]) => void;
  setFilter: (filter: { severity?: string; category?: string }) => void;
  clearFindings: () => void;
}

export const useFindingsStore = create<FindingsState>((set) => ({
  findings: [],
  filter: {},
  
  addFinding: (finding: Finding) =>
    set((state) => ({
      findings: [finding, ...state.findings].slice(0, 100), // Keep last 100 findings
    })),
  
  setFindings: (findings: Finding[]) => set({ findings }),
  
  setFilter: (filter: { severity?: string; category?: string }) =>
    set({ filter }),
  
  clearFindings: () => set({ findings: [] }),
}));

