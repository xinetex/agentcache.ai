import { describe, expect, it } from 'vitest';
import { soulprintParser } from '../../src/services/SoulprintParser.js';

describe('SoulprintParser', () => {
  it('parses structured YAML/agent manifest content', async () => {
    const content = `
name: "Test Agent"
tagline: "A test agent for parsing"
tools:
  - name: "search"
    description: "Search the web"
  - name: "calc"
    description: "Calculate values"
requires:
  - "auth-service"
  - "data-layer"
`;
    const result = await soulprintParser.parse({
      kind: 'agent.yaml',
      ref: 'test://agent.yaml',
      content
    });

    expect(result.findings).toContainEqual(expect.objectContaining({ category: 'capability' }));
    expect(result.findings).toContainEqual(expect.objectContaining({ category: 'dependency' }));
    expect(result.findings).toContainEqual(expect.objectContaining({ category: 'identity' }));
    expect(result.links).toContain('auth-service');
    expect(result.links).toContain('data-layer');
  });

  it('parses unstructured content for links', async () => {
    const content = 'Check out https://github.com/agentcache-ai/core and http://agentcache.ai/docs for more info.';
    const result = await soulprintParser.parse({
      kind: 'readme.txt',
      ref: 'test://readme.txt',
      content
    });

    expect(result.links).toContain('https://github.com/agentcache-ai/core');
    expect(result.links).toContain('http://agentcache.ai/docs');
    expect(result.findings).toHaveLength(0);
  });
});
