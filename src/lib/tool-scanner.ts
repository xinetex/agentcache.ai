/**
 * Tool Safety Scanner — Static Analysis Engine
 *
 * Scans agent tool/plugin source code for security threats before installation.
 * Supports JavaScript/TypeScript and Python source.
 *
 * Threat Categories:
 *   1. Credential Harvesting (critical)
 *   2. Data Exfiltration (critical)
 *   3. Code Obfuscation (high)
 *   4. Privilege Escalation (high)
 *   5. Scope Violation (medium)
 *   6. MCP Manifest Risks (medium)
 */

import { createHash } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Verdict = 'trusted' | 'caution' | 'dangerous';
export type Language = 'javascript' | 'python' | 'unknown';

export type ThreatCategory =
    | 'credential_harvesting'
    | 'data_exfiltration'
    | 'code_obfuscation'
    | 'privilege_escalation'
    | 'scope_violation'
    | 'mcp_risk';

export interface Finding {
    category: ThreatCategory;
    severity: Severity;
    line: number;
    matched: string;         // The pattern that matched
    snippet: string;         // The source line (truncated)
    explanation: string;
}

export interface ScanResult {
    contentHash: string;
    toolName: string;
    language: Language;
    trustScore: number;      // 0.0 – 1.0
    verdict: Verdict;
    findings: Finding[];
    stats: {
        linesScanned: number;
        patternsChecked: number;
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
    };
    scannedAt: string;
}

export interface McpManifestResult {
    risks: Finding[];
    permissionScope: 'minimal' | 'moderate' | 'broad' | 'excessive';
}

// ============================================================================
// THREAT PATTERNS
// ============================================================================

interface ThreatPattern {
    category: ThreatCategory;
    severity: Severity;
    regex: RegExp;
    languages: ('javascript' | 'python' | 'any')[];
    explanation: string;
}

const THREAT_PATTERNS: ThreatPattern[] = [
    // ── Credential Harvesting (critical) ──────────────────────────────────
    {
        category: 'credential_harvesting',
        severity: 'critical',
        regex: /process\.env\[?\s*['"`]?(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|MOONSHOT|CLAW_API|DATABASE_URL|STRIPE|AWS_SECRET)/i,
        languages: ['javascript'],
        explanation: 'Reads sensitive environment variables — potential credential theft.',
    },
    {
        category: 'credential_harvesting',
        severity: 'critical',
        regex: /os\.(environ|getenv)\s*[\[(]\s*['"]?(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|DATABASE_URL|AWS_SECRET|STRIPE)/i,
        languages: ['python'],
        explanation: 'Reads sensitive environment variables via os.environ/getenv.',
    },
    {
        category: 'credential_harvesting',
        severity: 'critical',
        regex: /['"~]?\/?\.ssh\/|['"~]?\/?\.aws\/|['"~]?\/?\.config\/|['"~]?\/?\.netrc|keychain|keyring/i,
        languages: ['any'],
        explanation: 'Accesses credential storage paths (~/.ssh, ~/.aws, keychain).',
    },
    {
        category: 'credential_harvesting',
        severity: 'critical',
        regex: /chrome.*?(cookies|login\s*data|local\s*state)|firefox.*?cookies\.sqlite|brave.*?cookies/i,
        languages: ['any'],
        explanation: 'Accesses browser credential/cookie stores.',
    },
    {
        category: 'credential_harvesting',
        severity: 'high',
        regex: /(btoa|Buffer\.from)\s*\(.*?(env|key|secret|token|password)/i,
        languages: ['javascript'],
        explanation: 'Encodes secrets before transmission — exfiltration prep pattern.',
    },
    {
        category: 'credential_harvesting',
        severity: 'high',
        regex: /base64\.(b64encode|encodebytes)\s*\(.*?(environ|key|secret|token|password)/i,
        languages: ['python'],
        explanation: 'Base64-encodes secrets before transmission — exfiltration prep.',
    },

    // ── Data Exfiltration (critical) ──────────────────────────────────────
    {
        category: 'data_exfiltration',
        severity: 'critical',
        regex: /fetch\s*\(\s*['"`]https?:\/\/(?!localhost|127\.0\.0\.1|agentcache\.ai|api\.moonshot\.ai)/i,
        languages: ['javascript'],
        explanation: 'Makes outbound HTTP request to non-allowlisted domain.',
    },
    {
        category: 'data_exfiltration',
        severity: 'critical',
        regex: /axios\.(get|post|put|patch|delete|request)\s*\(\s*['"`]https?:\/\/(?!localhost|127\.0\.0\.1|agentcache\.ai)/i,
        languages: ['javascript'],
        explanation: 'Axios request to non-allowlisted domain.',
    },
    {
        category: 'data_exfiltration',
        severity: 'critical',
        regex: /requests?\.(get|post|put|patch|delete)\s*\(\s*['"]https?:\/\/(?!localhost|127\.0\.0\.1)/i,
        languages: ['python'],
        explanation: 'Python requests call to non-allowlisted domain.',
    },
    {
        category: 'data_exfiltration',
        severity: 'critical',
        regex: /(urllib\.request\.urlopen|httpx\.(get|post|AsyncClient)|aiohttp\.ClientSession)\s*\(/i,
        languages: ['python'],
        explanation: 'HTTP client usage — verify destination is trusted.',
    },
    {
        category: 'data_exfiltration',
        severity: 'critical',
        regex: /new\s+WebSocket\s*\(\s*['"`]wss?:\/\/(?!localhost|127\.0\.0\.1)/i,
        languages: ['javascript'],
        explanation: 'WebSocket connection to external endpoint.',
    },
    {
        category: 'data_exfiltration',
        severity: 'high',
        regex: /socket\.connect\s*\(\s*\(?['"](?!localhost|127\.0\.0\.1)/i,
        languages: ['python'],
        explanation: 'Raw socket connection to external host.',
    },
    {
        category: 'data_exfiltration',
        severity: 'high',
        regex: /(s3\.putObject|s3\.upload|gcs.*?upload|storage.*?bucket.*?upload)/i,
        languages: ['any'],
        explanation: 'Writes to cloud storage (S3/GCS) — verify this is expected.',
    },

    // ── Code Obfuscation (high) ───────────────────────────────────────────
    {
        category: 'code_obfuscation',
        severity: 'high',
        regex: /\beval\s*\(/,
        languages: ['any'],
        explanation: 'Uses eval() — can execute arbitrary code at runtime.',
    },
    {
        category: 'code_obfuscation',
        severity: 'high',
        regex: /new\s+Function\s*\(/,
        languages: ['javascript'],
        explanation: 'Function constructor — dynamically creates executable code.',
    },
    {
        category: 'code_obfuscation',
        severity: 'high',
        regex: /\b(exec|compile)\s*\(\s*[^)]*\b(input|request|data|payload|body|arg)/i,
        languages: ['python'],
        explanation: 'exec/compile on dynamic input — code injection risk.',
    },
    {
        category: 'code_obfuscation',
        severity: 'high',
        regex: /importlib\.import_module\s*\(\s*[^'"]/,
        languages: ['python'],
        explanation: 'Dynamic module import with computed name — supply chain risk.',
    },
    {
        category: 'code_obfuscation',
        severity: 'high',
        regex: /pickle\.(loads?|Unpickler)\s*\(/,
        languages: ['python'],
        explanation: 'Pickle deserialization — can execute arbitrary code.',
    },
    {
        category: 'code_obfuscation',
        severity: 'high',
        regex: /require\s*\(\s*[^'"]/,
        languages: ['javascript'],
        explanation: 'Dynamic require() with computed path — can load any module.',
    },
    {
        category: 'code_obfuscation',
        severity: 'medium',
        regex: /\\x[0-9a-f]{2}.*\\x[0-9a-f]{2}.*\\x[0-9a-f]{2}.*\\x[0-9a-f]{2}/i,
        languages: ['any'],
        explanation: 'Heavy hex escape sequences — potential code obfuscation.',
    },
    {
        category: 'code_obfuscation',
        severity: 'medium',
        regex: /String\.fromCharCode\s*\(.*,.*,.*,/,
        languages: ['javascript'],
        explanation: 'String.fromCharCode with multiple args — obfuscation pattern.',
    },
    {
        category: 'code_obfuscation',
        severity: 'medium',
        regex: /chr\s*\(\s*\d+\s*\)\s*\+\s*chr\s*\(\s*\d+\s*\)/,
        languages: ['python'],
        explanation: 'Character-by-character string construction — obfuscation pattern.',
    },

    // ── Privilege Escalation (high) ───────────────────────────────────────
    {
        category: 'privilege_escalation',
        severity: 'high',
        regex: /child_process\.(exec|execSync|spawn|spawnSync|execFile)\s*\(/,
        languages: ['javascript'],
        explanation: 'Executes shell commands — high-risk operation.',
    },
    {
        category: 'privilege_escalation',
        severity: 'high',
        regex: /(subprocess\.(run|Popen|call|check_output)|os\.(system|popen|exec[lv]?p?))\s*\(/,
        languages: ['python'],
        explanation: 'Executes shell commands via subprocess/os.',
    },
    {
        category: 'privilege_escalation',
        severity: 'high',
        regex: /fs\.(writeFile|writeFileSync|appendFile)\s*\(\s*['"`]\/(usr|etc|bin|sbin|var|System|Windows)/i,
        languages: ['javascript'],
        explanation: 'Writes to system directory — privilege escalation risk.',
    },
    {
        category: 'privilege_escalation',
        severity: 'high',
        regex: /open\s*\(\s*['"]\/(etc|usr|bin|sbin|var|System).*['"],\s*['"]w/i,
        languages: ['python'],
        explanation: 'Writes to system directory.',
    },
    {
        category: 'privilege_escalation',
        severity: 'high',
        regex: /shutil\.(rmtree|move)\s*\(\s*['"]\/(usr|etc|bin|home|var|tmp)/i,
        languages: ['python'],
        explanation: 'Destructive file operation on system path.',
    },
    {
        category: 'privilege_escalation',
        severity: 'medium',
        regex: /\bsudo\b|chmod\s+[0-7]{3,4}|npm\s+(install|i)\s+(-g|--global)/i,
        languages: ['any'],
        explanation: 'Privilege escalation or global install attempt.',
    },

    // ── Scope Violation (medium) ──────────────────────────────────────────
    {
        category: 'scope_violation',
        severity: 'medium',
        regex: /fs\.(readFile|readFileSync|readdir|readdirSync)\s*\(\s*['"`]\s*(\/|~|\.\.\/\.\.\/)/i,
        languages: ['javascript'],
        explanation: 'Reads files outside expected scope (root or parent traversal).',
    },
    {
        category: 'scope_violation',
        severity: 'medium',
        regex: /open\s*\(\s*['"](\.\.\/)+(\.\.\/|etc|home|usr)/i,
        languages: ['python'],
        explanation: 'Path traversal — reading files outside expected scope.',
    },
    {
        category: 'scope_violation',
        severity: 'medium',
        regex: /navigator\.(mediaDevices|geolocation|bluetooth|usb|serial|hid)/i,
        languages: ['javascript'],
        explanation: 'Accesses device hardware (camera, GPS, Bluetooth, USB).',
    },

    // ── MCP-related risks (detected in source, not manifest) ──────────────
    {
        category: 'mcp_risk',
        severity: 'medium',
        regex: /MCPClient|mcp_client|sse_client\s*\(\s*['"]https?:\/\/(?!localhost|127\.0\.0\.1)/i,
        languages: ['any'],
        explanation: 'Connects to external MCP server — verify server identity.',
    },
    {
        category: 'mcp_risk',
        severity: 'medium',
        regex: /StdioClientTransport|StreamableHTTPClientTransport/i,
        languages: ['any'],
        explanation: 'Uses MCP transport — ensure server is trusted and pinned.',
    },
];

// ============================================================================
// SEVERITY WEIGHTS & SCORING
// ============================================================================

const SEVERITY_WEIGHTS: Record<Severity, number> = {
    critical: 0.3,
    high: 0.2,
    medium: 0.1,
    low: 0.05,
};

function calculateTrustScore(findings: Finding[]): number {
    if (findings.length === 0) return 1.0;

    let penalty = 0;
    for (const f of findings) {
        penalty += SEVERITY_WEIGHTS[f.severity];
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, +(1 - penalty).toFixed(3)));
}

function deriveVerdict(score: number): Verdict {
    if (score >= 0.8) return 'trusted';
    if (score >= 0.5) return 'caution';
    return 'dangerous';
}

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

export function detectLanguage(source: string): Language {
    const lines = source.split('\n').slice(0, 50).join('\n'); // Check first 50 lines

    // Strong Python indicators
    const pyScore =
        (lines.includes('import ') ? 2 : 0) +
        (lines.includes('from ') && lines.includes(' import ') ? 2 : 0) +
        (lines.includes('def ') ? 2 : 0) +
        (lines.includes('@tool') ? 3 : 0) +
        (lines.includes('class ') && lines.includes(':') && !lines.includes('{') ? 2 : 0) +
        (/if\s+__name__\s*==/.test(lines) ? 3 : 0) +
        (lines.includes('print(') ? 1 : 0);

    // Strong JS/TS indicators
    const jsScore =
        (/\b(const|let|var)\s+/.test(lines) ? 2 : 0) +
        (lines.includes('require(') ? 2 : 0) +
        (/import\s+.*\s+from\s+['"]/.test(lines) ? 2 : 0) +
        (/=>\s*{/.test(lines) ? 2 : 0) +
        (lines.includes('function ') ? 1 : 0) +
        (lines.includes('module.exports') ? 3 : 0) +
        (lines.includes('export ') ? 2 : 0) +
        (/:\s*(string|number|boolean|any)\b/.test(lines) ? 3 : 0); // TypeScript types

    if (pyScore > jsScore && pyScore >= 3) return 'python';
    if (jsScore > pyScore && jsScore >= 3) return 'javascript';
    return 'unknown';
}

// ============================================================================
// CONTENT HASH
// ============================================================================

export function hashSource(source: string): string {
    return createHash('sha256').update(source).digest('hex');
}

// ============================================================================
// MAIN SCAN FUNCTION
// ============================================================================

export function scanSource(
    source: string,
    options: { name?: string; language?: Language } = {}
): ScanResult {
    const language = options.language && options.language !== 'unknown'
        ? options.language
        : detectLanguage(source);

    const lines = source.split('\n');
    const findings: Finding[] = [];
    let patternsChecked = 0;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        if (!line.trim() || line.trim().startsWith('//') || line.trim().startsWith('#')) continue;

        for (const pattern of THREAT_PATTERNS) {
            // Filter by language
            if (!pattern.languages.includes('any') &&
                !pattern.languages.includes(language as 'javascript' | 'python')) {
                continue;
            }
            patternsChecked++;

            const match = pattern.regex.exec(line);
            if (match) {
                findings.push({
                    category: pattern.category,
                    severity: pattern.severity,
                    line: lineNum + 1,
                    matched: match[0],
                    snippet: line.trim().substring(0, 120),
                    explanation: pattern.explanation,
                });
            }
        }
    }

    const trustScore = calculateTrustScore(findings);
    const verdict = deriveVerdict(trustScore);

    const stats = {
        linesScanned: lines.length,
        patternsChecked,
        criticalCount: findings.filter(f => f.severity === 'critical').length,
        highCount: findings.filter(f => f.severity === 'high').length,
        mediumCount: findings.filter(f => f.severity === 'medium').length,
        lowCount: findings.filter(f => f.severity === 'low').length,
    };

    return {
        contentHash: hashSource(source),
        toolName: options.name || 'unnamed-tool',
        language,
        trustScore,
        verdict,
        findings,
        stats,
        scannedAt: new Date().toISOString(),
    };
}

// ============================================================================
// MCP MANIFEST SCANNER
// ============================================================================

const BROAD_MCP_PERMISSIONS = [
    'file_system', 'shell', 'network', 'exec', 'write',
    'admin', 'root', 'sudo', 'system', 'all',
];

export function scanManifest(manifest: any): McpManifestResult {
    const risks: Finding[] = [];

    if (!manifest || typeof manifest !== 'object') {
        return { risks: [], permissionScope: 'minimal' };
    }

    // Check tools array
    const tools = manifest.tools || manifest.capabilities || [];
    const toolArray = Array.isArray(tools) ? tools : [tools];

    let broadPermCount = 0;

    for (const tool of toolArray) {
        const name = tool.name || tool.id || 'unknown';
        const description = (tool.description || '').toLowerCase();
        const permissions = [
            ...(tool.permissions || []),
            ...(tool.scopes || []),
            ...(tool.capabilities || []),
        ].map((p: any) => (typeof p === 'string' ? p : p?.name || '').toLowerCase());

        // Check for broad permissions
        for (const perm of permissions) {
            for (const broad of BROAD_MCP_PERMISSIONS) {
                if (perm.includes(broad)) {
                    broadPermCount++;
                    risks.push({
                        category: 'mcp_risk',
                        severity: 'medium',
                        line: 0,
                        matched: `permission: ${perm}`,
                        snippet: `Tool "${name}" requests "${perm}"`,
                        explanation: `Tool "${name}" requests broad permission "${perm}" — verify this is necessary.`,
                    });
                }
            }
        }

        // Check for shell/exec in tool description
        if (/shell|exec|command|system|subprocess/i.test(description)) {
            risks.push({
                category: 'privilege_escalation',
                severity: 'high',
                line: 0,
                matched: `description mentions shell/exec`,
                snippet: `Tool "${name}": ${description.substring(0, 100)}`,
                explanation: `Tool "${name}" describes shell/command execution capability.`,
            });
        }

        // Check for file system access in description
        if (/file.*write|write.*file|modify.*file|delete.*file|remove.*file/i.test(description)) {
            risks.push({
                category: 'scope_violation',
                severity: 'medium',
                line: 0,
                matched: `description mentions file writes`,
                snippet: `Tool "${name}": ${description.substring(0, 100)}`,
                explanation: `Tool "${name}" describes file write capability — verify scope.`,
            });
        }
    }

    // Check server endpoint
    const serverUrl = manifest.server?.url || manifest.endpoint || manifest.url || '';
    if (serverUrl && !/localhost|127\.0\.0\.1|agentcache\.ai/i.test(serverUrl)) {
        risks.push({
            category: 'mcp_risk',
            severity: 'medium',
            line: 0,
            matched: `server: ${serverUrl}`,
            snippet: `MCP server at external endpoint: ${serverUrl}`,
            explanation: 'MCP server is hosted externally — verify server identity and trust.',
        });
    }

    // Determine permission scope
    let permissionScope: McpManifestResult['permissionScope'];
    if (broadPermCount >= 4) permissionScope = 'excessive';
    else if (broadPermCount >= 2) permissionScope = 'broad';
    else if (broadPermCount >= 1) permissionScope = 'moderate';
    else permissionScope = 'minimal';

    return { risks, permissionScope };
}
