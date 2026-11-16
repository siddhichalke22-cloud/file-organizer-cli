import { lstat, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCategoryMapper } from './categoryMapper.js';
import { scanDirectory } from './fileScanner.js';
import { findAvailableDestination, moveFileSafely } from './fileMover.js';
import { appendHistory, getDefaultHistoryPath } from './historyManager.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function organizeDirectory(
  targetDirectory,
  {
    dryRun = false,
    customCategories = {},
    historyPath = getDefaultHistoryPath(),
    protectedDirectory = packageRoot
  } = {}
) {
  if (!targetDirectory || typeof targetDirectory !== 'string') {
    throw new TypeError('Please provide a directory to organize.');
  }

  let targetStats;
  let resolvedDirectory;
  try {
    targetStats = await lstat(targetDirectory);
    if (targetStats.isSymbolicLink()) throw new Error('The target directory cannot be a symbolic link.');
    if (!targetStats.isDirectory()) throw new Error('The target path is not a directory.');
    resolvedDirectory = await realpath(targetDirectory);
  } catch (error) {
    throw new Error(`Invalid directory "${targetDirectory}": ${error.message}`, { cause: error });
  }

  if (resolvedDirectory === path.parse(resolvedDirectory).root) {
    throw new Error('For safety, a filesystem root cannot be organized.');
  }
  if (protectedDirectory) {
    const resolvedProtectedDirectory = await realpath(protectedDirectory);
    if (isWithin(resolvedProtectedDirectory, resolvedDirectory)) {
      throw new Error('For safety, the package installation directory cannot be organized.');
    }
  }

  const mapper = createCategoryMapper(customCategories);
  const scan = await scanDirectory(resolvedDirectory);
  const result = {
    directory: resolvedDirectory,
    filesScanned: scan.files.length,
    filesOrganized: 0,
    filesPlanned: 0,
    filesSkipped: scan.skipped,
    filesFailed: scan.errors.length,
    foldersCreated: [],
    movedFiles: [],
    errors: scan.errors
  };

  if (dryRun) {
    const plannedDestinations = new Set();
    for (const file of scan.files) {
      const categoryDirectory = path.join(resolvedDirectory, mapper.getCategory(path.extname(file.name)));
      try {
        let destinationPath;
        try {
          const stats = await lstat(categoryDirectory);
          if (!stats.isDirectory() || stats.isSymbolicLink()) {
            throw new Error(`Category destination "${categoryDirectory}" is not a safe directory.`);
          }
          destinationPath = await findAvailableDestination(categoryDirectory, file.name);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          destinationPath = path.join(categoryDirectory, file.name);
        }
        if (plannedDestinations.has(destinationPath)) {
          result.filesFailed += 1;
          result.errors.push({ path: file.path, error: new Error('Another scanned file has the same planned destination.') });
          continue;
        }
        plannedDestinations.add(destinationPath);
        result.filesPlanned += 1;
      } catch (error) {
        result.filesFailed += 1;
        result.errors.push({ path: file.path, error });
      }
    }
    return result;
  }

  for (const file of scan.files) {
    const category = mapper.getCategory(path.extname(file.name));
    const categoryDirectory = path.join(resolvedDirectory, category);
    let destinationPath;

    try {
      try {
        await mkdir(categoryDirectory);
        result.foldersCreated.push(category);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const stats = await lstat(categoryDirectory);
        if (!stats.isDirectory() || stats.isSymbolicLink()) {
          throw new Error(`Category destination "${categoryDirectory}" is not a safe directory.`);
        }
      }

      while (true) {
        destinationPath = await findAvailableDestination(categoryDirectory, file.name);
        try {
          await moveFileSafely(file.path, destinationPath, file);
          break;
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
        }
      }
      result.filesOrganized += 1;
      result.movedFiles.push({ originalPath: file.path, destinationPath });
    } catch (error) {
      result.filesFailed += 1;
      result.errors.push({ path: file.path, error });
    }
  }

  if (result.movedFiles.length > 0) {
    await appendHistory(
      { directory: resolvedDirectory, movedFiles: result.movedFiles },
      historyPath
    );
  }

  return result;
}
