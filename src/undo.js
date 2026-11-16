import { lstat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { moveFileSafely } from './fileMover.js';
import { getDefaultHistoryPath, readHistory, writeHistory } from './historyManager.js';

export async function undoLastOperation({ historyPath = getDefaultHistoryPath() } = {}) {
  const history = await readHistory(historyPath);
  const record = history.at(-1);
  if (!record) return { restored: 0, skipped: 0, failed: 0, errors: [] };

  let restored = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];
  const remainingFiles = [];
  const movedFiles = [...record.movedFiles].reverse();

  for (const file of movedFiles) {
    try {
      await lstat(file.originalPath);
      skipped += 1;
      remainingFiles.push(file);
      continue;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        failed += 1;
        errors.push({ path: file.originalPath, error });
        remainingFiles.push(file);
        continue;
      }
    }

    try {
      await mkdir(path.dirname(file.originalPath), { recursive: true });
      await moveFileSafely(file.destinationPath, file.originalPath);
      restored += 1;
    } catch (error) {
      if (error.code === 'ENOENT') {
        skipped += 1;
      }
      else {
        failed += 1;
        errors.push({ path: file.destinationPath, error });
        remainingFiles.push(file);
      }
    }
  }

  if (remainingFiles.length) {
    history[history.length - 1] = { ...record, movedFiles: remainingFiles };
  } else {
    history.pop();
  }
  await writeHistory(history, historyPath, 'update');

  return { restored, skipped, failed, errors };
}
