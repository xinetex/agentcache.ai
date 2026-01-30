
import { ShodanClient, ShodanHost } from '../lib/shodan.js';

interface RiskAlert {
    ip: string;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    details: any;
}

export class SentryAgent {
    private shodan: ShodanClient;
    private monitoredIPs: string[] = [];

    // Whitelist specific ports if needed (e.g. 80/443 might be okay)
    private PORT_WHITELIST = [80, 443];

    constructor(monitoredIPs: string[] = []) {
        this.shodan = new ShodanClient();
        this.monitoredIPs = monitoredIPs;
    }

    /**
     * Run a check on all monitored IPs
     */
    async checkExposure(): Promise<RiskAlert[]> {
        const alerts: RiskAlert[] = [];
        console.log(`[Sentry] Starting check for ${this.monitoredIPs.length} IPs...`);

        for (const ip of this.monitoredIPs) {
            try {
                const hostInfo = await this.shodan.getHost(ip);

                if (!hostInfo) {
                    // IP not found in Shodan - this is usually good for backend nodes!
                    continue;
                }

                const ipAlerts = this.analyzeHost(hostInfo);
                alerts.push(...ipAlerts);

            } catch (error) {
                console.error(`[Sentry] Failed to check ${ip}:`, error);
                alerts.push({
                    ip,
                    level: 'LOW',
                    message: `Check failed for ${ip}. Check API key or network.`,
                    details: { error: String(error) }
                });
            }
        }

        return alerts;
    }

    /**
     * Analyze a single host for risks
     */
    private analyzeHost(host: ShodanHost): RiskAlert[] {
        const alerts: RiskAlert[] = [];
        const { ip_str, ports, data } = host;

        console.log(`[Sentry] Analyzing ${ip_str}, open ports: ${ports.join(', ')}`);

        // Check 1: Critical Infrastructure Ports
        if (ports.includes(6379)) {
            alerts.push({
                ip: ip_str,
                level: 'CRITICAL',
                message: 'Redis (6379) is exposed to the public internet!',
                details: { port: 6379, transport: 'tcp' }
            });
        }

        if (ports.includes(5432) || ports.includes(3306)) {
            alerts.push({
                ip: ip_str,
                level: 'HIGH',
                message: 'Database (PostgreSQL/MySQL) port is exposed!',
                details: { ports: ports.filter(p => [5432, 3306].includes(p)) }
            });
        }

        if (ports.includes(22)) {
            alerts.push({
                ip: ip_str,
                level: 'MEDIUM',
                message: 'SSH (22) is exposed. Ensure strong auth or firewall restrictions.',
                details: { port: 22 }
            });
        }

        // Check 2: Vulnerabilities (if Shodan enterprise/vulns allowed)
        if (host.vulns && host.vulns.length > 0) {
            alerts.push({
                ip: ip_str,
                level: 'HIGH',
                message: `Host has ${host.vulns.length} known CVEs.`,
                details: { vulns: host.vulns }
            });
        }

        // Check 3: Unexpected ports (anything not in whitelist)
        const unknownPorts = ports.filter(p => !this.PORT_WHITELIST.includes(p));
        if (unknownPorts.length > 0) {
            // We only alert as INFO/LOW if not already caught above
            // Filter out ones we already alerted on to avoid noise?
            // For now, raw exposure of untracked ports is a risk.
            const alreadyAlerted = alerts.some(a =>
                (a.details.port && unknownPorts.includes(a.details.port)) ||
                (a.details.ports && a.details.ports.some((p: number) => unknownPorts.includes(p)))
            );

            if (!alreadyAlerted) {
                alerts.push({
                    ip: ip_str,
                    level: 'LOW',
                    message: `Unexpected exposed ports: ${unknownPorts.join(', ')}`,
                    details: { ports: unknownPorts }
                });
            }
        }

        return alerts;
    }
}
