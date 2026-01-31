import { CREDIT_PACKAGES, SERVICE_COSTS, AUTO_TOPOFF_THRESHOLDS } from '../../src/config/credits.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const packages = Object.values(CREDIT_PACKAGES).map((pkg) => ({
    ...pkg,
    creditsPerDollar: (pkg.credits / (pkg.price / 100)).toFixed(0),
  }));

  return res.status(200).json({
    packages,
    service_costs: SERVICE_COSTS,
    auto_topoff_thresholds: AUTO_TOPOFF_THRESHOLDS,
  });
}
