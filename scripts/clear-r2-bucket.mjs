/**
 * Clear R2 Bucket using Cloudflare REST API
 * 
 * This script uses the Cloudflare API to list and delete all objects from a bucket
 */

const ACCOUNT_ID = "fb7dc7b69b662480cd5961a4d1913c78";
const R2_BUCKET = "cloudless-assets";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!API_TOKEN) {
  console.error("❌ CLOUDFLARE_API_TOKEN environment variable not set");
  process.exit(1);
}

async function listR2Objects(page = 1) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects?page=${page}&per_page=1000`,
    {
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

async function deleteR2Object(key) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`,
    {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Delete failed: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

async function clearBucket() {
  console.log(`🧹 Clearing R2 bucket: ${R2_BUCKET}...\n`);
  
  let totalObjects = 0;
  let totalDeleted = 0;
  let page = 1;

  // List and delete objects in batches
  while (true) {
    try {
      const data = await listR2Objects(page);
      
      if (!data.success) {
        console.error("❌ API Error:", data.errors);
        break;
      }

      const objects = data.result || [];
      
      if (objects.length === 0) {
        console.log(`   ℹ️ No more objects to delete (bucket is empty)`);
        break;
      }

      console.log(`   Processing page ${page} - ${objects.length} objects...`);
      totalObjects += objects.length;

      // Delete each object
      for (const obj of objects) {
        try {
          await deleteR2Object(obj.key);
          totalDeleted++;
          if (totalDeleted % 50 === 0) {
            console.log(`   Deleted ${totalDeleted}/${totalObjects} objects...`);
          }
        } catch (error) {
          console.error(`   Failed to delete ${obj.key}:`, error.message);
        }
      }

      // Check if we've processed all pages
      const totalPages = data.result_info?.total_pages || 1;
      if (page >= totalPages) {
        break;
      }
      
      page++;
    } catch (error) {
      console.error("❌ Error:", error.message);
      break;
    }
  }

  console.log(`\n✅ Cleared ${totalDeleted} objects from R2 bucket ${R2_BUCKET}`);
  return totalDeleted;
}

clearBucket().catch(console.error);