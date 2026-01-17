/**
 * QChannel Device Pairing API
 * POST /api/qchannel/pair - Register device pairing
 * GET /api/qchannel/pair/:deviceId - Get pairing status
 * 
 * Enables second screen phone sync with Roku
 */

import { db } from '../../lib/db.js';
import { platformMemory } from '../../lib/platform-memory.js';

const PAIRING_CACHE_NAMESPACE = 'qchannel/pairing';
const PAIRING_TTL_SECONDS = 3600; // 1 hour pairing validity

export default async function handler(req) {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const deviceId = pathParts[pathParts.length - 1];

    if (req.method === 'POST') {
        return handlePairDevice(req);
    } else if (req.method === 'GET' && deviceId && deviceId !== 'pair') {
        return handleGetPairingStatus(deviceId);
    } else {
        return handleGeneratePairingCode();
    }
}

async function handlePairDevice(req) {
    try {
        const body = await req.json();
        const { deviceId, pairingToken, userId } = body;

        if (!deviceId || !pairingToken) {
            return new Response(JSON.stringify({
                error: 'Missing deviceId or pairingToken'
            }), { status: 400 });
        }

        // Store pairing in cache
        const pairingData = {
            deviceId,
            pairingToken,
            userId: userId || null,
            pairedAt: new Date().toISOString(),
            status: 'paired',
            watchlist: [],
            notifications: {
                priceAlerts: true,
                newsAlerts: true
            }
        };

        await platformMemory.set(PAIRING_CACHE_NAMESPACE, `device:${deviceId}`, pairingData, {
            ttl: PAIRING_TTL_SECONDS * 24 // 24 hour validity for paired devices
        });

        // Generate QR code URL for pairing
        const pairUrl = `https://qryptomarket-news.vercel.app/pair/${deviceId}?token=${pairingToken}`;

        return new Response(JSON.stringify({
            success: true,
            deviceId,
            pairUrl,
            status: 'paired',
            expiresIn: PAIRING_TTL_SECONDS * 24
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('[QChannel Pair] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500
        });
    }
}

async function handleGetPairingStatus(deviceId) {
    try {
        const cached = await platformMemory.get(PAIRING_CACHE_NAMESPACE, `device:${deviceId}`);

        if (cached && cached.data) {
            return new Response(JSON.stringify({
                paired: true,
                ...cached.data
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        return new Response(JSON.stringify({
            paired: false,
            deviceId,
            message: 'Device not paired. Scan QR code to pair.'
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500
        });
    }
}

async function handleGeneratePairingCode() {
    // Generate a temporary pairing code
    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + 300000).toISOString(); // 5 min expiry

    await platformMemory.set(PAIRING_CACHE_NAMESPACE, `code:${code}`, {
        code,
        createdAt: new Date().toISOString(),
        expiresAt,
        status: 'pending'
    }, { ttl: 300 });

    return new Response(JSON.stringify({
        code,
        expiresAt,
        instructions: 'Enter this code at qchannel.app/activate or scan the QR code'
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

function generatePairingCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
