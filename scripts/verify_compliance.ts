// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'ac_demo_compliance_test';

async function runTest() {
    console.log('🏥 Starting Healthcare Compliance Verification...');
    console.log(`Target: ${API_URL}`);

    // 1. Test PII Redaction
    console.log('\n1. Testing PII Redaction...');
    const piiText = "Patient John Doe (SSN: 123-45-6789) admitted on 2023-10-27. MRN: MRN123456. Email: john@example.com";

    const piiRes = await fetch(`${API_URL}/api/pii`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({ text: piiText, apiKey: API_KEY })
    });

    const piiData = await piiRes.json();
    if (!piiRes.ok) {
        console.error('❌ PII Redaction Failed:', piiData);
        process.exit(1);
    }

    console.log('Original:', piiText);
    console.log('Redacted:', piiData.redacted);
    console.log('Findings:', piiData.findings);
    console.log('Risk Score:', piiData.riskScore);

    if (piiData.redacted.includes('123-45-6789') || piiData.redacted.includes('john@example.com')) {
        console.error('❌ FAILED: PII leaked in output!');
        process.exit(1);
    } else {
        console.log('✅ PII Successfully Redacted');
    }

    // 2. Test Audit Logging
    console.log('\n2. Testing Immutable Audit Log...');
    const auditRes = await fetch(`${API_URL}/api/audit/log`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            action: 'ACCESS_PATIENT_RECORD',
            resourceId: 'PAT-1001',
            actor: 'Dr. Smith',
            status: 'success',
            details: { reason: 'Routine Checkup' }
        })
    });

    const auditData = await auditRes.json();
    if (!auditRes.ok) {
        console.error('❌ Audit Log Failed:', auditData);
        process.exit(1);
    }

    console.log('✅ Audit Log Created:', auditData.logId);

    console.log('\n✨ Compliance Verification Complete!');
}

runTest().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
