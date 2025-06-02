// server/api/load-file.ts
import { readFile } from 'fs/promises';
import { join } from 'path';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const relPath = query.path;
  if (!relPath || typeof relPath !== 'string') {
    return { error: 'Missing or invalid path' };
  }
  // Allow .vue files in pages/ or components/, and .ts/.js files in utils/ or composables/
  if (!relPath.match(/^(pages|components)\/.+\.vue$/) && !relPath.match(/^(utils|composables)\/.+\.[jt]s$/)) {
    return { error: 'Invalid file path' };
  }
  // Prevent directory traversal
  if (relPath.includes('..')) {
    return { error: 'Invalid file path' };
  }
  const absPath = join(process.cwd(), relPath);
  try {
    const code = await readFile(absPath, 'utf8');
    return code;
  } catch {
    return { error: 'Failed to read file' };
  }
});
