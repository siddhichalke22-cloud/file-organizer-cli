import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { organizeDirectory } from '../src/organizer.js';
import { undoLastOperation } from '../src/undo.js';

const temporaryDirectories = [];

async function makeDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'file-organizer-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('undoLastOperation', () => {
  it('restores moved files to their original paths', async () => {
    const directory = await makeDirectory();
    const historyPath = path.join(directory, 'history.json');
    const originalPath = path.join(directory, 'song.mp3');
    await writeFile(originalPath, 'audio');

    await organizeDirectory(directory, { historyPath });
    const result = await undoLastOperation({ historyPath });

    expect(result.restored).toBe(1);
    expect(await readFile(originalPath, 'utf8')).toBe('audio');
  });

  it('does not overwrite a file recreated at the original path', async () => {
    const directory = await makeDirectory();
    const historyPath = path.join(directory, 'history.json');
    const originalPath = path.join(directory, 'song.mp3');
    await writeFile(originalPath, 'audio');
    await organizeDirectory(directory, { historyPath });
    await writeFile(originalPath, 'keep this');

    const result = await undoLastOperation({ historyPath });

    expect(result.skipped).toBe(1);
    expect(await readFile(originalPath, 'utf8')).toBe('keep this');
  });
});
