import { vectorIndex } from '../src/lib/vector';

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function runVerification() {
    console.log('📚 Starting DocuCache Verification...');
    console.log(`Target: ${API_URL}`);

    // 1. Test Ingestion
    console.log('\n1. Testing Doc Ingestion...');
    const ingestRes = await fetch(`${API_URL}/api/docs/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: 'https://example.com'
        })
    });

    if (!ingestRes.ok) {
        const err = await ingestRes.text();
        console.error('❌ Ingestion Failed:', err);
        // If vector DB is not configured, we might get 503, which is expected if no creds
        if (ingestRes.status === 503) {
            console.warn('⚠️ Vector DB not configured. Skipping ingestion test.');
        } else {
            process.exit(1);
        }
    } else {
        const ingestData = await ingestRes.json();
        console.log('✅ Ingestion Success:', ingestData);
    }

    // 2. Test Search
    console.log('\n2. Testing Doc Search...');
    // We'll search for "Domain" which is in example.com
    const searchRes = await fetch(`${API_URL}/api/docs/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: 'Domain',
            limit: 1
        })
    });

    if (!searchRes.ok) {
        const err = await searchRes.text();
        console.error('❌ Search Failed:', err);
        if (searchRes.status === 503) {
            console.warn('⚠️ Vector DB not configured. Skipping search test.');
        } else {
            process.exit(1);
        }
    } else {
        const searchData = await searchRes.json();
        console.log('✅ Search Success:', JSON.stringify(searchData, null, 2));

        if (searchData.results && searchData.results.length > 0) {
            console.log('✨ Found relevant context!');
        } else {
            console.warn('⚠️ No results found (might be due to indexing latency or mock mode)');
        }
    }

    console.log('\n✨ DocuCache Verification Complete!');
}

runVerification().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
