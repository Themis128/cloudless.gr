// Set CORS policy on R2 bucket for website hosting
// Usage: node scripts/r2-cors-policy.js

import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

config();

const ACCOUNT_ID = 'fb7dc7b69b662480cd5961a4d1913c78';
const BUCKET_NAME = 'cloudless-assets';

async function setCorsPolicy() {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_API_TOKEN,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_API_TOKEN,
    },
  });

  try {
    // For API token, we need to use the token as both keyId and secret
    // with scoped permissions - check if we have proper access
    const command = new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ['*'],
            AllowedMethods: ['GET', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    });

    await s3.send(command);
    console.log('✅ CORS policy set on cloudless-assets bucket');
  } catch (error) {
    console.error('❌ CORS setup requires S3 API access with proper permissions');
    console.error('Error:', error.message);
    console.log('\nManual alternative: Cloudflare Dashboard → Workers & Pages → R2 → cloudless-assets → Settings → CORS');
  }
}

setCorsPolicy();