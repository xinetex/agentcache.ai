/**
 * Overflow Partner Webhook Registry
 * 
 * Manages partner webhooks for Anti-Cache URL change notifications
 */

export interface OverflowPartner {
  id: string;
  name: string;
  webhook?: string;
  split: number; // Revenue share percentage (0-1)
  active: boolean;
}

/**
 * Hardcoded overflow partners (MVP)
 * In production, this would be a database table
 */
export const OVERFLOW_PARTNERS: OverflowPartner[] = [
  {
    id: 'redis-labs',
    name: 'Redis Labs',
    webhook: process.env.REDIS_LABS_WEBHOOK,
    split: 0.30,
    active: true
  },
  {
    id: 'pinecone',
    name: 'Pinecone',
    webhook: process.env.PINECONE_WEBHOOK,
    split: 0.20,
    active: true
  },
  {
    id: 'together-ai',
    name: 'Together.ai',
    webhook: process.env.TOGETHER_WEBHOOK,
    split: 0.20,
    active: true
  }
];

/**
 * Get active partners with webhooks configured
 */
export function getActivePartnersWithWebhooks(): OverflowPartner[] {
  return OVERFLOW_PARTNERS.filter(p => p.active && p.webhook);
}

/**
 * Get partner by ID
 */
export function getPartnerById(id: string): OverflowPartner | undefined {
  return OVERFLOW_PARTNERS.find(p => p.id === id);
}

/**
 * Get all active partners (for API responses)
 */
export function getAllActivePartners(): OverflowPartner[] {
  return OVERFLOW_PARTNERS.filter(p => p.active);
}
