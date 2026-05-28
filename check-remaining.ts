import { config } from "dotenv";
config({ path: ".env.local" });

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const KEY = process.env.NOTION_API_KEY;

const REMAINING_DBS: Record<string, string> = {
  NOTION_CALENDAR_DB_ID: "Calendar",
  NOTION_REPORTS_DB_ID: "Reports",
  NOTION_TESTIMONIALS_DB_ID: "Testimonials",
  NOTION_CASE_STUDIES_DB_ID: "Case Studies",
  NOTION_SERVICES_DB_ID: "Services",
  NOTION_FAQS_DB_ID: "FAQs",
};

async function getDbSchema(dbId: string | undefined, name: string) {
  if (!dbId) {
    console.log(`[${name}] Not configured`);
    return;
  }

  try {
    const res = await fetch(`${API}/databases/${dbId}`, {
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Notion-Version": VERSION,
      },
    });

    if (!res.ok) {
      console.log(`[${name}] Error ${res.status}`);
      return;
    }

    const db = await res.json();
    const props = Object.entries(db.properties || {}).map(([pname, prop]: [string, any]) => {
      return `${pname}: ${prop.type}`;
    });
    
    console.log(`[${name}]`);
    props.forEach(p => console.log(`  ${p}`));
  } catch (err: any) {
    console.log(`[${name}] ${err.message}`);
  }
}

async function main() {
  for (const [envKey, name] of Object.entries(REMAINING_DBS)) {
    const dbId = process.env[envKey];
    await getDbSchema(dbId, name);
    console.log();
  }
}

main();
