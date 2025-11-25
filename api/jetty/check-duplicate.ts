import { jettySpeedDb } from '../../src/services/jettySpeedDb';

export const config = {
  runtime: 'nodejs',
};

interface CheckDuplicateRequest {
  fileHash: string;
  userId: string;
  fileName?: string;
  fileSize?: number;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json() as CheckDuplicateRequest;

    if (!body.fileHash || !body.userId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: fileHash, userId' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if file already exists
    const existingFile = await jettySpeedDb.checkFileHash(body.fileHash);

    if (existingFile) {
      // Calculate savings
      const savedCost = body.fileSize 
        ? (body.fileSize / 1024 / 1024 / 1024) * 0.10 
        : 0;

      // Create user file reference
      if (body.fileName) {
        await jettySpeedDb.createUserFileReference({
          user_id: body.userId,
          file_hash: body.fileHash,
          file_name: body.fileName,
        });
      }

      return new Response(JSON.stringify({
        isDuplicate: true,
        file: {
          fileId: existingFile.file_id,
          url: `https://s3.lyvecloud.seagate.com/${existingFile.storage_key}`,
          fileName: existingFile.file_name,
          fileSize: existingFile.file_size,
          mimeType: existingFile.mime_type,
          uploadCount: existingFile.upload_count,
          firstUploadedAt: existingFile.first_uploaded_at,
        },
        savings: {
          bytes: body.fileSize || existingFile.file_size,
          cost: parseFloat(savedCost.toFixed(4)),
        },
        message: 'File already exists. Instant zero-copy clone available.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // File doesn't exist
    return new Response(JSON.stringify({
      isDuplicate: false,
      message: 'File is unique. Proceed with upload.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Check duplicate error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
