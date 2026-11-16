#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createRequire } from 'node:module';
import { organizeDirectory } from '../src/organizer.js';
import { undoLastOperation } from '../src/undo.js';
import { loadCustomCategories } from '../src/utils.js';
import { createCategoryMapper } from '../src/categoryMapper.js';

const program = new Command();
const { version } = createRequire(import.meta.url)('../package.json');

function requireDirectory(value) {
  if (!value) throw new InvalidArgumentError('A directory path is required.');
  return value;
}

function displayErrors(errors) {
  for (const { path, error } of errors) {
    console.error(chalk.red(`  ${path}: ${error.message}`));
  }
}

function displaySummary(result, dryRun) {
  const movedLabel = dryRun ? 'Files that would be organized' : 'Files organized';
  console.log('');
  console.log(chalk.bold(dryRun ? 'Preview completed!' : 'Organization completed!'));
  console.log(`Files scanned:    ${result.filesScanned}`);
  console.log(`${movedLabel.padEnd(30)}${dryRun ? result.filesPlanned : result.filesOrganized}`);
  console.log(`Files skipped:    ${result.filesSkipped}`);
  console.log(`Files failed:     ${result.filesFailed}`);
  if (result.foldersCreated.length) {
    console.log(`Folders created:  ${result.foldersCreated.join(', ')}`);
  }
  if (result.errors.length) displayErrors(result.errors);
}

program
  .name('file-organizer')
  .description('Organize files in one directory by extension. Subdirectories are never scanned.')
  .version(version)
  .argument('[directory]', 'directory whose immediate files should be organized', requireDirectory)
  .option('--dry-run', 'preview file moves without changing files')
  .option('--undo', 'undo the most recent organization operation')
  .option('--config <path>', 'JSON configuration file with custom categories')
  .addHelpText(
    'after',
    '\nExamples:\n  $ file-organizer ./Downloads\n  $ file-organizer ./Downloads --dry-run\n  $ file-organizer ./Downloads --undo\n'
  )
  .action(async (directory, options) => {
    if (options.undo && options.dryRun) {
      throw new InvalidArgumentError('--undo and --dry-run cannot be used together.');
    }

    if (options.undo) {
      const spinner = ora('Undoing the most recent organization...').start();
      let result;
      try {
        result = await undoLastOperation();
      } finally {
        spinner.stop();
      }
      console.log(chalk.green(`Undo completed: ${result.restored} restored, ${result.skipped} skipped, ${result.failed} failed.`));
      if (result.errors.length) displayErrors(result.errors);
      return;
    }
    if (!directory) {
      program.outputHelp();
      throw new InvalidArgumentError('A directory path is required unless --undo is specified.');
    }

    const customCategories = await loadCustomCategories(options.config);
    const mapper = createCategoryMapper(customCategories);
    console.log(chalk.bold.cyan('\n========================================'));
    console.log(chalk.bold.cyan('       FILE ORGANIZER CLI'));
    console.log(chalk.bold.cyan('========================================\n'));
    console.log(`Scanning directory: ${directory}`);

    const spinner = ora(options.dryRun ? 'Previewing files...' : 'Organizing files...').start();
    let result;
    try {
      result = await organizeDirectory(directory, {
        dryRun: options.dryRun,
        customCategories
      });
    } finally {
      spinner.stop();
    }

    for (const category of Object.keys(mapper.categories)) {
      if (result.foldersCreated.includes(category)) {
        console.log(chalk.green(`[✓] ${category} folder created`));
      }
    }
    displaySummary(result, options.dryRun);
  });

program.showHelpAfterError();
program.parseAsync().catch((error) => {
  console.error(chalk.red(`Error: ${error.message}`));
  process.exitCode = 1;
});
