import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { organizeDirectory } from '../src/organizer.js';

const temporaryDirectories = [];

async function makeDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'file-organizer-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('organizeDirectory', () => {
  it('organizes files, records history, and reports skipped directories', async () => {
    const directory = await makeDirectory();
    const historyPath = path.join(directory, 'history.json');
    await mkdir(path.join(directory, 'subfolder'));
    await writeFile(path.join(directory, 'photo.png'), 'image');
    await writeFile(path.join(directory, 'notes.txt'), 'text');

    const result = await organizeDirectory(directory, { historyPath });

    expect(result.filesScanned).toBe(2);
    expect(result.filesOrganized).toBe(2);
    expect(result.filesSkipped).toBe(1);
    expect(await readFile(path.join(directory, 'Images', 'photo.png'), 'utf8')).toBe('image');
    expect(await readFile(path.join(directory, 'Documents', 'notes.txt'), 'utf8')).toBe('text');
    expect(JSON.parse(await readFile(historyPath, 'utf8'))).toHaveLength(1);
  });

  it('selects numbered names for duplicates without overwriting existing files', async () => {
    const directory = await makeDirectory();
    const historyPath = path.join(directory, 'history.json');
    await mkdir(path.join(directory, 'Images'));
    await writeFile(path.join(directory, 'photo.jpg'), 'new');
    await writeFile(path.join(directory, 'Images', 'photo.jpg'), 'existing');
    await writeFile(path.join(directory, 'Images', 'photo (1).jpg'), 'also existing');

    const result = await organizeDirectory(directory, { historyPath });

    expect(result.filesOrganized).toBe(1);
    expect(await readFile(path.join(directory, 'Images', 'photo.jpg'), 'utf8')).toBe('existing');
    expect(await readFile(path.join(directory, 'Images', 'photo (2).jpg'), 'utf8')).toBe('new');
  });

  it('previews without creating folders, moving files, or writing history', async () => {
    const directory = await makeDirectory();
    const historyPath = path.join(directory, 'history.json');
    await writeFile(path.join(directory, 'preview.mp4'), 'video');

    const result = await organizeDirectory(directory, { dryRun: true, historyPath });

    expect(result.filesOrganized).toBe(0);
    expect(result.filesPlanned).toBe(1);
    expect(await readdir(directory)).toEqual(['preview.mp4']);
  });

  it('reports an invalid directory with a useful message', async () => {
    await expect(organizeDirectory(path.join(os.tmpdir(), 'missing-file-organizer-dir'))).rejects.toThrow('Invalid directory');
  });

  it('does not organize the package installation directory', async () => {
    const directory = await makeDirectory();
    await expect(
      organizeDirectory(directory, { protectedDirectory: directory, historyPath: path.join(directory, 'history.json') })
    ).rejects.toThrow('installation directory');
  });
});
