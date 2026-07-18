/**
 * Cloudflare API utility functions
 * Extracted for testability and reusability
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Execute curl commands against Cloudflare API
 * Following error handling best practices from implementation guide
 */
export async function cfApi<T = unknown>(
	path: string,
	method = 'GET',
	data?: string,
): Promise<{ success: boolean; data: T; error?: string }> {
	// Validate environment variables at runtime
	if (!process.env.CLOUDFLARE_API_TOKEN) {
		return {
			success: false,
			data: {} as T,
			error: 'CLOUDFLARE_API_TOKEN not set',
		};
	}

	if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
		return {
			success: false,
			data: {} as T,
			error: 'CLOUDFLARE_ACCOUNT_ID not set',
		};
	}

	const headers = [
		`Authorization: Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
		'Content-Type: application/json',
		'Accept: application/json',
	];

	const curlArgs = [
		'-s',
		'-X',
		method,
		...headers.flatMap((h) => ['-H', h]),
		data ? '-d' : '',
		data || '',
	].filter(Boolean);

	const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}${path}`;
	const cmd = `curl ${curlArgs.map((a) => `"${a}"`).join(' ')} "${url}"`;

	try {
		const { stdout } = await execAsync(cmd, {
			timeout: 30000, // 30 second timeout for network calls
		});

		const response = JSON.parse(stdout) as T & {
			success?: boolean;
			errors?: string[];
		};

		if (response.errors) {
			return {
				success: false,
				data: response as T,
				error: response.errors!.join(', '),
			};
		}

		return {
			success: true,
			data: response as T,
		};
	} catch (error) {
		return {
			success: false,
			data: {} as T,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}