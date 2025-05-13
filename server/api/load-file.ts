// server/api/load-file.ts
import { readFile } from "fs/promises";
import { join } from "path";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const relPath = query.path;
  if (!relPath || typeof relPath !== "string") {
    return { error: "Missing or invalid path" };
  }
  // Only allow .vue files in pages/ or components/ for security
  if (!relPath.match(/^(pages|components)\/.+\.vue$/)) {
    return { error: "Invalid file path" };
  }
  // Prevent directory traversal
  if (relPath.includes("..")) {
    return { error: "Invalid file path" };
  }
  const absPath = join(process.cwd(), relPath);
  try {
    const code = await readFile(absPath, "utf8");
    return code;
  } catch (e) {
    return { error: "Failed to read file" };
  }
});
