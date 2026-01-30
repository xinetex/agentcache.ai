
import postgres from 'postgres';
import { createHash } from 'crypto';
import 'dotenv/config';

const BANNERS = [
    { text: "Server: Apache/2.4.49 (Unix)", product: "Apache", version: "2.4.49", risk: 9.8, vulns: ["CVE-2021-41773"] },
    { text: "Server: nginx/1.18.0", product: "Nginx", version: "1.18.0", risk: 5.3, vulns: ["CVE-2021-23017"] },
    { text: "Server: Microsoft-IIS/10.0", product: "IIS", version: "10.0", risk: 2.0, vulns: [] },
    { text: "Server: Apache/2.2.15 (CentOS)", product: "Apache", version: "2.2.15", risk: 8.0, vulns: ["CVE-2012-0053"] },
    { text: "X-Powered-By: PHP/5.3.3", product: "PHP", version: "5.3.3", risk: 9.0, vulns: ["CVE-2011-4885"] },
    { text: "Server: Jetty(9.4.31.v20200723)", product: "Jetty", version: "9.4.31", risk: 4.0, vulns: [] },
    { text: "Server: lighttpd/1.4.55", product: "lighttpd", version: "1.4.55", risk: 6.0, vulns: [] },
    { text: "Server: OpenSSH_7.4", product: "OpenSSH", version: "7.4", risk: 7.5, vulns: ["CVE-2018-15473"] },
    { text: "Server: Exim 4.89", product: "Exim", version: "4.89", risk: 9.5, vulns: ["CVE-2019-10149"] },
    { text: "Server: nginx/1.14.0 (Ubuntu)", product: "Nginx", version: "1.14.0", risk: 6.0, vulns: [] },
    { text: "Server: Apache/2.4.29 (Ubuntu)", product: "Apache", version: "2.4.29", risk: 4.0, vulns: [] },
    { text: "Server: Boa/0.94.13", product: "Boa", version: "0.94.13", risk: 9.0, vulns: ["Arbitrary File Access"] },
    { text: "Server: RomPager/4.07", product: "RomPager", version: "4.07", risk: 9.8, vulns: ["Misfortune Cookie"] },
    { text: "Server: MiniUPnPd/1.0", product: "MiniUPnPd", version: "1.0", risk: 7.0, vulns: [] },
    { text: "Server: Hikvision-Webs", product: "Hikvision", version: "Unknown", risk: 8.5, vulns: ["Backdoor"] }
];

async function seed() {
    if (!process.env.DATABASE_URL) throw new Error("No DATABASE_URL");
    const sql = postgres(process.env.DATABASE_URL);

    console.log('🌱 Seeding Semantic Shadow Graph (Direct PG)...');

    for (const b of BANNERS) {
        const hash = createHash('sha256').update(b.text).digest('hex');

        // 1. Bancache
        await sql`
            INSERT INTO "bancache" ("hash", "banner_text", "first_seen_at", "last_seen_at", "seen_count")
            VALUES (${hash}, ${b.text}, NOW(), NOW(), ${Math.floor(Math.random() * 100) + 1})
            ON CONFLICT ("hash") DO NOTHING
        `;

        // 2. Analysis
        await sql`
            INSERT INTO "banner_analysis" ("banner_hash", "agent_model", "risk_score", "classification", "vulnerabilities", "reasoning", "analyzed_at", "compliance")
            VALUES (
                ${hash}, 
                'seed-script', 
                ${b.risk}, 
                ${b.product}, 
                ${sql.json(b.vulns)}, 
                ${`Seeded analysis for ${b.product} ${b.version}. Known vulnerabilities: ${b.vulns.join(', ') || 'None critical'}.`},
                NOW(),
                '{}'::jsonb
            )
            ON CONFLICT DO NOTHING
        `;

        console.log(`Visited ${b.product}`);
    }

    console.log('✅ Seeding Complete!');
    await sql.end();
}

seed().catch(console.error);
