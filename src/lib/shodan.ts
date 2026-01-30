
export interface ShodanHost {
    ip_str: string;
    org: string;
    os: string;
    ports: number[];
    vulns?: string[];
    hostnames: string[];
    data: {
        port: number;
        transport: string;
        product?: string;
        version?: string;
    }[];
}

export class ShodanClient {
    private apiKey: string;
    private baseUrl: string = 'https://api.shodan.io';

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.SHODAN_API_KEY || '';
        if (!this.apiKey) {
            console.warn('ShodanClient: No API key provided. Sentry checks will fail.');
        }
    }

    /**
     * Get information about a specific IP address
     */
    async getHost(ip: string): Promise<ShodanHost | null> {
        if (!this.apiKey) return null;

        try {
            const url = `${this.baseUrl}/shodan/host/${ip}?key=${this.apiKey}`;
            const response = await fetch(url);

            if (response.status === 404) {
                return null; // Host not found (good!)
            }

            if (!response.ok) {
                throw new Error(`Shodan API error: ${response.statusText}`);
            }

            return await response.json() as ShodanHost;
        } catch (error) {
            console.error(`Shodan getHost error for ${ip}:`, error);
            throw error;
        }
    }

    /**
     * Search Shodan for a query
     */
    async search(query: string, options: { facets?: string, page?: number, minify?: boolean } = {}): Promise<{ matches: ShodanHost[], total: number, facets?: any }> {
        if (!this.apiKey) return { matches: [], total: 0 };

        try {
            const params = new URLSearchParams({
                key: this.apiKey,
                query: query,
            });

            if (options.facets) params.append('facets', options.facets);
            if (options.page) params.append('page', options.page.toString());
            if (options.minify) params.append('minify', 'true');

            const url = `${this.baseUrl}/shodan/host/search?${params.toString()}`;
            const response = await fetch(url);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Shodan API error: ${response.status} ${response.statusText} - ${errText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Shodan search error for "${query}":`, error);
            throw error;
        }
    }

    /**
     * Account Profile (to check credits)
     */
    async getProfile(): Promise<any> {
        if (!this.apiKey) return null;
        try {
            const url = `${this.baseUrl}/account/profile?key=${this.apiKey}`;
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error("Shodan profile error:", error);
            return null;
        }
    }
}
