import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

dotenv.config({ path: '.env.vercel' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const customers = ['audio1_tv', 'jettythunder_app', 'clawsave_com'] as const;
const services = [
  'cdn_streaming',
  'transcoding',
  'file_provisioning',
  'edge_routing',
  'chunk_caching',
  'user_stats',
  'ai_processing',
  'core_caching',
  'other',
] as const;
const dates = ['2026-04-01', '2026-04-02', '2026-04-03'] as const;

async function main() {
  const out: Record<string, any> = {};

  for (const customer of customers) {
    out[customer] = { daily: {}, services: {} };

    for (const date of dates) {
      const [requests, errors, ingress, egress] = await Promise.all([
        redis.get(`usage:${customer}:${date}:requests`),
        redis.get(`usage:${customer}:${date}:errors`),
        redis.get(`usage:${customer}:${date}:ingress_bytes`),
        redis.get(`usage:${customer}:${date}:egress_bytes`),
      ]);

      out[customer].daily[date] = {
        requests: Number(requests) || 0,
        errors: Number(errors) || 0,
        ingress_bytes: Number(ingress) || 0,
        egress_bytes: Number(egress) || 0,
      };

      for (const service of services) {
        const [serviceRequests, serviceEgress] = await Promise.all([
          redis.get(`usage:${customer}:${service}:${date}`),
          redis.get(`usage:${customer}:${service}:${date}:egress_bytes`),
        ]);

        if ((Number(serviceRequests) || 0) > 0 || (Number(serviceEgress) || 0) > 0) {
          out[customer].services[`${date}:${service}`] = {
            requests: Number(serviceRequests) || 0,
            egress_bytes: Number(serviceEgress) || 0,
          };
        }
      }
    }
  }

  const sampleKeys = await redis.keys('usage:*');
  out.__sampleKeys = sampleKeys.slice(0, 200);

  console.log(JSON.stringify(out, null, 2));
}

await main();
