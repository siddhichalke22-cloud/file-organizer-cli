import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

export function getDefaultHistoryPath() {
  return path.join(os.homedir(), '.file-organizer-cli', 'history.json');
}

export async function readHistory(historyPath = getDefaultHistoryPath()) {
  try {
    const contents = await readFile(historyPath, 'utf8');
    const history = JSON.parse(contents);
    if (!Array.isArray(history)) throw new Error('History must be a JSON array');
    return history;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Cannot read organization history: ${error.message}`, { cause: error });
  }
}

export async function appendHistory(record, historyPath = getDefaultHistoryPath()) {
  const history = await readHistory(historyPath);
  history.push({ ...record, id: randomUUID(), createdAt: new Date().toISOString() });

  await writeHistory(history, historyPath, 'save');
}

export async function writeHistory(history, historyPath = getDefaultHistoryPath(), action = 'update') {
  await mkdir(path.dirname(historyPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${historyPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(history, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx'
    });
    await rename(temporaryPath, historyPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw new Error(`Cannot ${action} organization history: ${error.message}`, { cause: error });
  }
}
