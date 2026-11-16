import { constants } from 'node:fs';
import { open, lstat, unlink } from 'node:fs/promises';
import path from 'node:path';

function withNumberedSuffix(filename, number) {
  const parsed = path.parse(filename);
  return `${parsed.name} (${number})${parsed.ext}`;
}

export async function findAvailableDestination(directory, filename) {
  let candidate = path.join(directory, filename);
  let suffix = 1;

  while (true) {
    try {
      await lstat(candidate);
      candidate = path.join(directory, withNumberedSuffix(filename, suffix));
      suffix += 1;
    } catch (error) {
      if (error.code === 'ENOENT') return candidate;
      throw error;
    }
  }
}

export async function moveFileSafely(sourcePath, destinationPath, expectedIdentity) {
  let source;
  let destination;
  let destinationIdentity;
  let destinationCreated = false;

  try {
    source = await open(sourcePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const sourceStats = await source.stat();
    if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
      throw new Error('Source is not a regular file');
    }
    if (
      expectedIdentity &&
      (sourceStats.dev !== expectedIdentity.dev || sourceStats.ino !== expectedIdentity.ino)
    ) {
      throw new Error('Source file changed after it was scanned');
    }

    destination = await open(destinationPath, 'wx', sourceStats.mode & 0o777);
    destinationCreated = true;
    destinationIdentity = await destination.stat();

    const buffer = Buffer.alloc(64 * 1024);
    let position = 0;
    while (true) {
      const { bytesRead } = await source.read(buffer, 0, buffer.length, position);
      if (bytesRead === 0) break;

      let written = 0;
      while (written < bytesRead) {
        const result = await destination.write(buffer, written, bytesRead - written, position + written);
        written += result.bytesWritten;
      }
      position += bytesRead;
    }

    await source.close();
    source = undefined;
    await destination.close();
    destination = undefined;

    const currentSource = await lstat(sourcePath);
    if (currentSource.dev !== sourceStats.dev || currentSource.ino !== sourceStats.ino) {
      throw new Error('Source file changed while it was being moved');
    }
    await unlink(sourcePath);
    return true;
  } catch (error) {
    if (source) await source.close().catch(() => {});
    if (destination) await destination.close().catch(() => {});

    if (destinationCreated) {
      try {
        const current = await lstat(destinationPath);
        if (
          destinationIdentity &&
          current.dev === destinationIdentity.dev &&
          current.ino === destinationIdentity.ino
        ) {
          await unlink(destinationPath);
        }
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          error.message += ` (Could not clean up partial destination: ${cleanupError.message})`;
        }
      }
    }
    throw error;
  }
}
