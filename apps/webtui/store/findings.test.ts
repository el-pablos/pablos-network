import { describe, it, expect, beforeEach } from 'vitest';
import { useFindingsStore } from './findings';

describe('Findings Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useFindingsStore.setState({ findings: [], filter: {} });
  });

  it('should add a new finding', () => {
    const { addFinding } = useFindingsStore.getState();

    const newFinding = {
      _id: 'finding-1',
      targetFqdn: 'example.com',
      provider: 'dns',
      category: 'DNS',
      severity: 'high' as const,
      title: 'Subdomain Takeover Risk',
      description: 'Dangling CNAME record detected',
      createdAt: new Date(),
    };

    addFinding(newFinding);

    const state = useFindingsStore.getState();
    expect(state.findings).toHaveLength(1);
    expect(state.findings[0]._id).toBe('finding-1');
  });

  it('should filter findings by severity', () => {
    const { addFinding, setFilter, getFilteredFindings } = useFindingsStore.getState();

    // Add findings with different severities
    addFinding({
      _id: 'finding-1',
      targetFqdn: 'example.com',
      provider: 'dns',
      category: 'DNS',
      severity: 'critical' as const,
      title: 'Critical Finding',
      description: 'Test',
      createdAt: new Date(),
    });

    addFinding({
      _id: 'finding-2',
      targetFqdn: 'example.com',
      provider: 'dns',
      category: 'DNS',
      severity: 'low' as const,
      title: 'Low Finding',
      description: 'Test',
      createdAt: new Date(),
    });

    setFilter({ severity: 'critical' });

    const filtered = getFilteredFindings();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].severity).toBe('critical');
  });

  it('should show all findings when filter is "all"', () => {
    const { addFinding, setFilter, getFilteredFindings } = useFindingsStore.getState();

    addFinding({
      _id: 'finding-1',
      targetFqdn: 'example.com',
      provider: 'dns',
      category: 'DNS',
      severity: 'critical' as const,
      title: 'Critical Finding',
      description: 'Test',
      createdAt: new Date(),
    });

    addFinding({
      _id: 'finding-2',
      targetFqdn: 'example.com',
      provider: 'dns',
      category: 'DNS',
      severity: 'low' as const,
      title: 'Low Finding',
      description: 'Test',
      createdAt: new Date(),
    });

    setFilter({ severity: 'all' });

    const filtered = getFilteredFindings();
    expect(filtered).toHaveLength(2);
  });

  it('should prevent duplicate findings', () => {
    const { addFinding } = useFindingsStore.getState();

    const finding = {
      _id: 'finding-1',
      targetFqdn: 'example.com',
      provider: 'dns',
      category: 'DNS',
      severity: 'high' as const,
      title: 'Test Finding',
      description: 'Test',
      createdAt: new Date(),
    };

    addFinding(finding);
    addFinding(finding); // Try to add duplicate

    const state = useFindingsStore.getState();
    expect(state.findings).toHaveLength(1);
  });
});

