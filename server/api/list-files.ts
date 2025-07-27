// server/api/list-files.ts
import { readdir, stat } from 'fs/promises'
import { defineEventHandler, getQuery } from 'h3'
import { join } from 'path'

export default defineEventHandler(async (event: any) => {
  const ext = getQuery(event).ext?.toString() || 'vue'
  const directory = getQuery(event).dir?.toString() || 'pages'

  try {
    const files = await listFilesByExtension(directory, ext)
    return {
      success: true,
      files,
      count: files.length,
      directory,
      extension: ext,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      directory,
      extension: ext,
    }
  }
})

async function listFilesByExtension(
  dir: string,
  ext: string
): Promise<string[]> {
  const files: string[] = []

  try {
    const items = await readdir(dir)

    for (const item of items) {
      const fullPath = join(dir, item)
      const stats = await stat(fullPath)

      if (stats.isDirectory()) {
        const subFiles = await listFilesByExtension(fullPath, ext)
        files.push(...subFiles)
      } else if (item.endsWith(`.${ext}`)) {
        files.push(fullPath)
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error)
  }

  return files
}
