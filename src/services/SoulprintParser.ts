import { type SoulprintArtifact, type SoulprintFinding, type SoulprintTopology } from './SoulprintService.js';
import yaml from 'js-yaml';

export type ParsedArtifactResult = {
  findings: SoulprintFinding[];
  biasFlags: string[];
  topology: SoulprintTopology;
  metadata: Record<string, unknown>;
  links: string[];
};

export class SoulprintParser {
  async parse(artifact: SoulprintArtifact): Promise<ParsedArtifactResult> {
    const { kind, content } = artifact;
    
    if (kind.toLowerCase().includes('yaml') || kind.toLowerCase().includes('skill') || kind.toLowerCase().includes('agent')) {
      return this.parseStructured(content);
    }
    
    return this.parseUnstructured(content);
  }

  private parseStructured(content: string): ParsedArtifactResult {
    const findings: SoulprintFinding[] = [];
    const biasFlags: string[] = [];
    const topology: SoulprintTopology = {};
    const links: string[] = [];
    let metadata: Record<string, unknown> = {};

    try {
      // Attempt to parse as YAML or JSON
      const data = yaml.load(content) as any;
      metadata = typeof data === 'object' ? data : { raw: data };

      if (data?.tools && Array.isArray(data.tools)) {
        findings.push({
          category: 'capability',
          summary: `Defined ${data.tools.length} tool(s).`,
          severity: 'low'
        });
      }

      if (data?.requires && Array.isArray(data.requires)) {
        links.push(...data.requires);
        findings.push({
          category: 'dependency',
          summary: `Dependent on ${data.requires.length} external skill(s)/agent(s).`,
          severity: 'medium'
        });
      }

      // Detect specific "Library" pattern keywords
      if (data?.name && data?.tagline) {
        findings.push({
          category: 'identity',
          summary: 'Uses standardized manifest format.',
          severity: 'low'
        });
      }

    } catch (e) {
      // Fallback to unstructured if YAML parsing fails
      return this.parseUnstructured(content);
    }

    return { findings, biasFlags, topology, metadata, links };
  }

  private parseUnstructured(content: string): ParsedArtifactResult {
    const findings: SoulprintFinding[] = [];
    const biasFlags: string[] = [];
    const topology: SoulprintTopology = {};
    const links: string[] = [];

    // Extract potential links (GitHub, URLs, etc)
    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
    const matches = content.match(urlRegex);
    if (matches) {
      links.push(...matches);
    }

    return { findings, biasFlags, topology, metadata: {}, links };
  }
}

export const soulprintParser = new SoulprintParser();
