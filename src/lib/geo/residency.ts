/**
 * AgentCache Data Residency Enforcer
 * 
 * Ensures data compliance by checking the request's origin against allowed regions.
 * Uses Vercel's 'x-vercel-ip-country' header.
 */

export type Region = 'US' | 'EU' | 'APAC' | 'GLOBAL';

const REGION_MAP: Record<Region, string[]> = {
    US: ['US', 'CA', 'MX'],
    EU: ['DE', 'FR', 'GB', 'IE', 'NL', 'SE', 'ES', 'IT', 'PL'],
    APAC: ['JP', 'SG', 'AU', 'IN', 'KR'],
    GLOBAL: [] // All allowed
};

export interface ResidencyResult {
    allowed: boolean;
    country: string;
    region: Region;
    error?: string;
}

export function checkResidency(req: Request, requiredRegion: Region = 'GLOBAL'): ResidencyResult {
    // Vercel Geolocation Header
    const country = req.headers.get('x-vercel-ip-country') || 'UNKNOWN';

    // If global, allow everything
    if (requiredRegion === 'GLOBAL') {
        return { allowed: true, country, region: 'GLOBAL' };
    }

    const allowedCountries = REGION_MAP[requiredRegion];

    if (!allowedCountries) {
        // Fallback for unknown region config
        return { allowed: false, country, region: requiredRegion, error: 'Invalid region configuration' };
    }

    // Check if country is in the allowed list
    if (allowedCountries.includes(country)) {
        return { allowed: true, country, region: requiredRegion };
    }

    // Localhost / Dev fallback
    if (country === 'UNKNOWN' && (req.url.includes('localhost') || req.url.includes('127.0.0.1'))) {
        return { allowed: true, country: 'LOCALHOST', region: requiredRegion };
    }

    return {
        allowed: false,
        country,
        region: requiredRegion,
        error: `Data residency violation: Request from ${country} not allowed in ${requiredRegion} region.`
    };
}
