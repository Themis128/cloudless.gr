import { getAuthDbFromEnv } from "./src/lib/auth-d1";
import { canUseD1Http, getHttpAuthDb } from "./src/lib/d1-http";

console.log('CLOUDFLARE_ACCOUNT_ID:', process.env.CLOUDFLARE_ACCOUNT_ID);
console.log('CLOUDFLARE_API_TOKEN:', process.env.CLOUDFLARE_API_TOKEN);
console.log('canUseD1Http():', canUseD1Http());

const httpDb = getHttpAuthDb();
console.log('getHttpAuthDb():', httpDb);

const db = getAuthDbFromEnv();
console.log('getAuthDbFromEnv():', db);