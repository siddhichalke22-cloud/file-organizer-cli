import { organizeDirectory } from '../src/organizer.js';

const result = await organizeDirectory('./Downloads', { dryRun: true });
console.log(`Would organize ${result.filesScanned} files.`);
