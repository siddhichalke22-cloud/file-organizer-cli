import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanDirectory } from '../src/fileScanner.js';
import { createCategoryMapper, getCategoryForFile } from '../src/categoryMapper.js';

const temporaryDirectories = [];

async function makeDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'file-organizer-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('category mapping', () => {
  it('detects extensions case-insensitively and maps unknown extensions to Others', () => {
    expect(getCategoryForFile('photo.JPEG')).toBe('Images');
    expect(getCategoryForFile('notes.txt')).toBe('Documents');
    expect(getCategoryForFile('unknown.xyz')).toBe('Others');
    expect(getCategoryForFile('LICENSE')).toBe('Others');
  });

  it('allows custom categories to override built-in mappings', () => {
    const mapper = createCategoryMapper({ Design: ['png', '.psd'] });
    expect(mapper.getCategory('PNG')).toBe('Design');
    expect(mapper.getCategory('psd')).toBe('Design');
  });

  it('rejects category names that could escape the target directory', () => {
    expect(() => createCategoryMapper({ '../outside': ['txt'] })).toThrow();
  });
});

describe('directory scanner', () => {
  it('returns regular files and skips directories and symbolic links', async () => {
    const directory = await makeDirectory();
    const nested = path.join(directory, 'nested');
    await mkdir(nested);
    await writeFile(path.join(directory, 'report.pdf'), 'data');
    await symlink(path.join(directory, 'report.pdf'), path.join(directory, 'linked.pdf'));

    const result = await scanDirectory(directory);
    expect(result.files.map((file) => file.name)).toEqual(['report.pdf']);
    expect(result.skipped).toBe(2);
  });
});
