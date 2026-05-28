import { config } from "dotenv";
config({ path: ".env.local" });

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const KEY = process.env.NOTION_API_KEY;

const DBS = {
  Blog: "0ac591657ee44063bbbc8004ea7ccd6c",
  Docs: "b45af6ed5bb64d89b9a92a8aff4a9b29",
  Projects: "a9bab34b945e484fb6b0aa6034086e5c",
  Tasks: "14ce4ff6c400437597b13e70ac909354",
  Submissions: "9abe0a5614d64b759d44a45cee2d0bbc",
  Analytics: "cc4287fcb42a42dc92a7053d6f1199c7",
  Calendar: "dcff73b9317b4ed69a450f200db0f629",
  Reports: "3d2851e41daa4904ab0f4099a9c10d19",
};

async function getDbSchema(dbId: string, name: string) {
  try {
    const res = await fetch(`${API}/databases/${dbId}`, {
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Notion-Version": VERSION,
      },
    });

    if (!res.ok) {
      console.log(`${name}: ERROR ${res.status}`);
      return null;
    }

    const db = await res.json();
    const props: Record<string, string> = {};
    Object.entries(db.properties || {}).forEach(([pname, prop]: [string, any]) => {
      props[pname] = prop.type;
    });
    
    return props;
  } catch (err: any) {
    console.log(`${name}: Exception ${err.message}`);
    return null;
  }
}

async function main() {
  for (const [name, dbId] of Object.entries(DBS)) {
    const schema = await getDbSchema(dbId, name);
    if (schema) {
      console.log(JSON.stringify({ db: name, schema }, null, 2));
    }
  }
}

main();
