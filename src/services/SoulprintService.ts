export type SoulprintArtifact = {
  kind: string;
  ref: string;
  content: string;
};

export type SoulprintFinding = {
  category: string;
  summary: string;
  severity?: 'low' | 'medium' | 'high';
};

export type SoulprintTopology = {
  escalationBias?: number;
  recencyBias?: number;
  authorityBias?: number;
  explorationBias?: number;
};

export type SoulprintScanResult = {
  sector?: string;
  confidence: number;
  summary: string;
  sources: Array<{ kind: string; ref: string; excerpt?: string }>;
  findings: SoulprintFinding[];
  biasFlags: string[];
  topology: SoulprintTopology;
};

type SignalRule = {
  biasFlag: string;
  category: string;
  summary: string;
  severity: 'low' | 'medium' | 'high';
  topologyKey: keyof SoulprintTopology;
  patterns: RegExp[];
};

const SIGNAL_RULES: SignalRule[] = [
  {
    biasFlag: 'escalation_bias',
    category: 'escalation',
    summary: 'Configuration leans toward human escalation and approval checkpoints.',
    severity: 'medium',
    topologyKey: 'escalationBias',
    patterns: [/human review/i, /escalat/i, /approval required/i, /manual approval/i],
  },
  {
    biasFlag: 'recency_bias',
    category: 'freshness',
    summary: 'Configuration strongly prioritizes current or latest information.',
    severity: 'medium',
    topologyKey: 'recencyBias',
    patterns: [/latest/i, /most recent/i, /current information/i, /fresh/i, /up[- ]to[- ]date/i],
  },
  {
    biasFlag: 'authority_bias',
    category: 'authority',
    summary: 'Configuration privileges policy, official sources, or approved authorities.',
    severity: 'medium',
    topologyKey: 'authorityBias',
    patterns: [/official source/i, /policy/i, /compliance/i, /administrator/i, /approved source/i],
  },
  {
    biasFlag: 'exploration_bias',
    category: 'exploration',
    summary: 'Configuration encourages branching, experimentation, or open-ended search.',
    severity: 'low',
    topologyKey: 'explorationBias',
    patterns: [/explore/i, /experiment/i, /multiple approaches/i, /brainstorm/i, /speculat/i],
  },
];

const SECTOR_HINTS: Array<{ sector: string; patterns: RegExp[] }> = [
  { sector: 'finance', patterns: [/trading/i, /portfolio/i, /pnl/i, /market/i, /risk/i, /kalshi/i] },
  { sector: 'healthcare', patterns: [/patient/i, /clinical/i, /hipaa/i, /medical/i, /diagnos/i] },
  { sector: 'legal', patterns: [/contract/i, /legal/i, /compliance/i, /regulator/i, /liability/i] },
  { sector: 'biotech', patterns: [/genom/i, /omics/i, /biotech/i, /protein/i] },
  { sector: 'robotics', patterns: [/robot/i, /sensor/i, /motion/i, /control system/i] },
  { sector: 'energy', patterns: [/energy/i, /grid/i, /load/i, /power/i] },
];

function clamp(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}

function makeExcerpt(content: string): string | undefined {
  const trimmed = content.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, 180) : undefined;
}

function mergeFindings(base: SoulprintFinding[], additions: SoulprintFinding[]): SoulprintFinding[] {
  const merged = new Map<string, SoulprintFinding>();
  for (const finding of [...base, ...additions]) {
    const key = `${finding.category}:${finding.summary}`;
    if (!merged.has(key)) {
      merged.set(key, finding);
    }
  }
  return Array.from(merged.values());
}

function mergeBiasFlags(base: string[] = [], additions: string[] = []): string[] {
  return Array.from(new Set([...base, ...additions]));
}

function mergeTopology(base: SoulprintTopology = {}, additions: SoulprintTopology = {}): SoulprintTopology {
  const keys: Array<keyof SoulprintTopology> = ['escalationBias', 'recencyBias', 'authorityBias', 'explorationBias'];
  const next: SoulprintTopology = {};
  for (const key of keys) {
    const values = [base[key], additions[key]].filter((value): value is number => typeof value === 'number');
    if (values.length) {
      next[key] = clamp(Math.max(...values));
    }
  }
  return next;
}

export class SoulprintService {
  scanArtifacts(input: {
    artifacts: SoulprintArtifact[];
    sector?: string;
    summary?: string;
    findings?: SoulprintFinding[];
    biasFlags?: string[];
    topology?: SoulprintTopology;
  }): SoulprintScanResult {
    const findings: SoulprintFinding[] = input.findings ? [...input.findings] : [];
    const biasFlags: string[] = input.biasFlags ? [...input.biasFlags] : [];
    let topology: SoulprintTopology = input.topology ? { ...input.topology } : {};

    const sectorScores = new Map<string, number>();
    let matchedSignals = 0;

    for (const artifact of input.artifacts) {
      const content = artifact.content || '';
      const lowered = content.toLowerCase();

      for (const rule of SIGNAL_RULES) {
        const hits = rule.patterns.filter((pattern) => pattern.test(content)).length;
        if (!hits) continue;

        matchedSignals += hits;
        findings.push({
          category: rule.category,
          summary: rule.summary,
          severity: rule.severity,
        });
        biasFlags.push(rule.biasFlag);
        topology = mergeTopology(topology, {
          [rule.topologyKey]: clamp((topology[rule.topologyKey] || 0) + hits * 0.22),
        });
      }

      for (const hint of SECTOR_HINTS) {
        const hits = hint.patterns.filter((pattern) => pattern.test(lowered)).length;
        if (!hits) continue;
        sectorScores.set(hint.sector, (sectorScores.get(hint.sector) || 0) + hits);
      }
    }

    const inferredSector = input.sector || Array.from(sectorScores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const dedupedFindings = mergeFindings([], findings);
    const dedupedFlags = mergeBiasFlags([], biasFlags);
    const confidence = clamp(
      0.45
        + Math.min(0.35, input.artifacts.length * 0.08)
        + Math.min(0.2, matchedSignals * 0.04)
        + (inferredSector ? 0.05 : 0),
    );

    return {
      sector: inferredSector,
      confidence,
      summary: input.summary
        || `Soulprint derived from ${input.artifacts.length} artifact${input.artifacts.length === 1 ? '' : 's'} with ${dedupedFindings.length} finding${dedupedFindings.length === 1 ? '' : 's'}.`,
      sources: input.artifacts.map((artifact) => ({
        kind: artifact.kind,
        ref: artifact.ref,
        excerpt: makeExcerpt(artifact.content),
      })),
      findings: dedupedFindings,
      biasFlags: dedupedFlags,
      topology,
    };
  }
}

export const soulprintService = new SoulprintService();
