// Configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

interface PinataResponse {
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
}

/**
 * Uploads a file to IPFS via Pinata using standard Web APIs (Edge compatible)
 * @param file The File object to upload
 * @returns The IPFS CID (Hash)
 */
export async function uploadToIPFS(file: File): Promise<string> {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
        throw new Error('Pinata credentials not configured (PINATA_API_KEY, PINATA_SECRET_KEY)');
    }

    const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
    const data = new FormData();

    data.append('file', file);

    const metadata = JSON.stringify({
        name: file.name,
        keyvalues: {
            source: 'agentcache-ai',
            timestamp: Date.now().toString()
        }
    });
    data.append('pinataMetadata', metadata);

    const options = JSON.stringify({
        cidVersion: 1
    });
    data.append('pinataOptions', options);

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: data,
            headers: {
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET_KEY,
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pinata upload failed: ${response.statusText} - ${errorText}`);
        }

        const result = (await response.json()) as PinataResponse;
        return result.IpfsHash;
    } catch (error) {
        console.error('Error uploading to IPFS:', error);
        throw error;
    }
}

/**
 * Returns the high-performance gateway URL for a given CID
 * @param cid The IPFS CID
 * @returns The full URL to access the file
 */
export function getGatewayUrl(cid: string): string {
    // Ensure no trailing slash on gateway and no leading slash on CID
    const cleanGateway = IPFS_GATEWAY.replace(/\/$/, '');
    const cleanCid = cid.replace(/^\//, '');
    return `${cleanGateway}/${cleanCid}`;
}
