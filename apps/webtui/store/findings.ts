import { create } from 'zustand';

export interface Finding {
  _id: string;
  targetFqdn: string;
  provider: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  createdAt: Date;
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
  getFilteredFindings: () => Finding[];
  clearFindings: () => void;
}

export const useFindingsStore = create<FindingsState>((set, get) => ({
  findings: [],
  filter: {},

  addFinding: (finding: Finding) =>
    set((state) => {
      // Prevent duplicates based on _id
      const exists = state.findings.some(f => f._id === finding._id);
      if (exists) {
        return state;
      }
      return {
        findings: [finding, ...state.findings].slice(0, 100), // Keep last 100 findings
      };
    }),

  setFindings: (findings: Finding[]) => set({ findings }),

  setFilter: (filter: { severity?: string; category?: string }) =>
    set({ filter }),

  getFilteredFindings: () => {
    const { findings, filter } = get();

    if (!filter.severity && !filter.category) {
      return findings;
    }

    return findings.filter(finding => {
      const severityMatch = !filter.severity || filter.severity === 'all' || finding.severity === filter.severity;
      const categoryMatch = !filter.category || filter.category === 'all' || finding.category === filter.category;
      return severityMatch && categoryMatch;
    });
  },

  clearFindings: () => set({ findings: [] }),
}));

