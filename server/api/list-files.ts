// server/api/list-files.ts
import { promises as fs } from 'fs';
import { join, relative } from 'path';

const allowedDirs = ['components', 'pages'];

async function walk(dir: string, ext: string, baseDir: string): Promise<string[]> {
  let results: string[] = [];
  const list = await fs.readdir(dir, { withFileTypes: true });
  for (const file of list) {
    const filePath = join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(await walk(filePath, ext, baseDir));
    } else if (file.isFile() && file.name.endsWith('.' + ext)) {
      results.push(relative(baseDir, filePath).replace(/\\/g, '/'));
    }
  }
  return results;
}

export default defineEventHandler(async (event) => {
  const ext = getQuery(event).ext?.toString() || 'vue';
  const cwd = process.cwd();
  let files: string[] = [];
  for (const dir of allowedDirs) {    try {
      const absDir = join(cwd, dir);
      const found = await walk(absDir, ext, cwd);
      files = files.concat(found);
    } catch (error) {
      // Log and ignore missing directories
      if (error instanceof Error) {
        console.error(`Directory not found: ${dir}`, error.message);
      } else {
        console.error(`Directory not found: ${dir}`, error);
      }
    }
  }
  return { files };
});
