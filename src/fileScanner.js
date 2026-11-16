import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

export async function scanDirectory(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Cannot read directory "${directory}": ${error.message}`, { cause: error });
  }

  const files = [];
  let skipped = 0;
  const errors = [];

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    try {
      const stats = await lstat(filePath);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        skipped += 1;
        continue;
      }
      files.push({ name: entry.name, path: filePath, dev: stats.dev, ino: stats.ino });
    } catch (error) {
      errors.push({ path: filePath, error });
    }
  }

  return { files, skipped, errors };
}
