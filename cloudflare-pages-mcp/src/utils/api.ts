/**
 * Cloudflare API utility functions
 * Extracted for testability and reusability
 */

/**
 * Call Cloudflare API via fetch (no shell) — avoids CodeQL js/indirect-command-line-injection.
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

	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	// Account IDs are hex; reject anything that could alter the URL path.
	if (!/^[a-f0-9]{32}$/i.test(accountId)) {
		return {
			success: false,
			data: {} as T,
			error: 'CLOUDFLARE_ACCOUNT_ID has unexpected format',
		};
	}

	if (typeof path !== 'string' || !path.startsWith('/')) {
		return {
			success: false,
			data: {} as T,
			error: 'path must be an absolute API path starting with /',
		};
	}

	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`;

	try {
		const response = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: data,
			signal: AbortSignal.timeout(30_000),
		});

		const json = (await response.json()) as T & {
			success?: boolean;
			errors?: Array<{ message?: string } | string>;
		};

		if (Array.isArray(json.errors) && json.errors.length > 0) {
			const errText = json.errors
				.map((e) => (typeof e === 'string' ? e : e.message || JSON.stringify(e)))
				.join(', ');
			return {
				success: false,
				data: json as T,
				error: errText,
			};
		}

		if (!response.ok) {
			return {
				success: false,
				data: json as T,
				error: `HTTP ${response.status}`,
			};
		}

		return {
			success: true,
			data: json as T,
		};
	} catch (error) {
		return {
			success: false,
			data: {} as T,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
