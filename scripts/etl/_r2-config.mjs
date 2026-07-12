/**
 * R2 Configuration Helper for ETL Scripts
 * Provides S3-compatible client factory - ETLs just need to import and use.
 */
import { S3Client } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CF_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CF_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

export function getS3Client() {
	if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
		return new S3Client({
			region: "auto",
			endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
			forcePathStyle: true,
			credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
		});
	}
	return new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
}

export const BUCKET = process.env.ANALYTICS_BUCKET || "datalake-bucket";
