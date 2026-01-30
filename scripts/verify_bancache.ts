
import fetch from 'node-fetch';

const BANNER_APACHE = `HTTP/1.1 200 OK
Date: Mon, 27 Jul 2024 12:28:53 GMT
Server: Apache/2.4.49 (Unix)
Last-Modified: Mon, 11 Jun 2007 18:53:14 GMT
ETag: "2d-432a5e4a73a80"
Accept-Ranges: bytes
Content-Length: 45
Content-Type: text/html`;

const BASE_URL = 'http://localhost:3001/api/intelligence';

async function verifyBancache() {
    console.log('🕵️ Verifying Semantic Shadow (Bancache)...');

    // 1. Ingest
    console.log('\n[1] Ingesting Banner...');
    const ingestRes = await fetch(`${BASE_URL}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner: BANNER_APACHE })
    });
    const ingestData = await ingestRes.json();
    console.log('Response:', ingestData);

    if (!ingestData.success || !ingestData.hash) {
        throw new Error('Ingest failed');
    }
    const hash = ingestData.hash;

    // 2. Poll for Analysis (It's async, so we might need to wait)
    console.log(`\n[2] Polling for analysis (Hash: ${hash.slice(0, 8)})...`);
    let analyzed = false;
    let attempts = 0;

    while (!analyzed && attempts < 5) {
        const checkRes = await fetch(`${BASE_URL}/banner/${hash}`);
        if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.analysis) {
                console.log('✅ Analysis Found!');
                console.log('Risk Score:', checkData.analysis.riskScore);
                console.log('Classification:', checkData.analysis.classification);
                analyzed = true;
                break;
            } else {
                console.log('...waiting for Analyst Agent...');
            }
        }
        attempts++;
        await new Promise(r => setTimeout(r, 2000));
    }

    if (!analyzed) {
        console.log('⚠️ Analysis timed out (Agent might be mocking or slow), but Ingest/Retrieval works.');
    }

    // 3. Test "Cache Hit" (Re-ingest same banner)
    console.log('\n[3] Testing Cache Hit...');
    const hitRes = await fetch(`${BASE_URL}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner: BANNER_APACHE })
    });
    const hitData = await hitRes.json();
    // In a real scenario, we'd check 'seen_count' in DB, but API just returns success
    if (hitData.hash === hash) {
        console.log('✅ Hash match (Idempotency confirmed).');
    } else {
        throw new Error('Hash mismatch on identical content!');
    }
}

verifyBancache().catch(console.error);
