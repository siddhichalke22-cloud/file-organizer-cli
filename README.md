# file-organizer-cli

A safe, non-recursive command-line tool that organizes the files immediately inside a directory into folders based on their extensions. It never scans child directories, overwrites a destination file, or runs without an explicitly supplied target (except for `--undo`).

## Features

- Organizes images, documents, video, audio, archives, code, and other files.
- Previews changes with `--dry-run`.
- Keeps same-name files by adding numbered suffixes such as `photo (1).jpg`.
- Records successful moves in `~/.file-organizer-cli/history.json` for undo.
- Supports custom extension categories from a JSON configuration file.
- Skips directories and symbolic links and reports failures.
- Refuses filesystem roots and the package's own installation directory.

## Requirements and installation

Node.js 18 or newer is required.

```sh
npm install -g file-organizer-cli
file-organizer ./Downloads
```

Or run it without a global install:

```sh
npx file-organizer-cli ./Downloads
```

## Commands

```sh
file-organizer <directory> [options]

Options:
  --dry-run       Preview moves without changing files
  --undo          Reverse the most recent organization operation
  --config <path> Load custom categories from a JSON file
  -h, --help      Display help
  -V, --version   Display the package version
```

Examples:

```sh
file-organizer ./Downloads
file-organizer ./Downloads --dry-run
file-organizer ./Downloads --config ./organizer.json
file-organizer --undo
```

Only files directly inside the specified directory are considered; subdirectories are left untouched. A target directory is required unless undoing. A filesystem root cannot be used as the target.

## Categories

Built-in categories include Images (PNG, JPG, JPEG, SVG, GIF, WEBP), Documents (PDF, DOC, DOCX, TXT, PPT, PPTX, XLS, XLSX, CSV), Videos (MP4, MKV, AVI, MOV), Audio (MP3, WAV, AAC), Archives (ZIP, RAR, TAR, GZ), Code (JS, TS, JSX, TSX, PY, JAVA, HTML, CSS), and Others.

Use a JSON file with a `categories` object to add extensions or override a built-in extension mapping:

```json
{
  "categories": {
    "Design": ["psd", "ai"],
    "Spreadsheets": ["ods", "numbers"]
  }
}
```

Then supply `--config ./organizer.json`. Extensions are case-insensitive and may include a leading dot. Category names are used as folder names, so path separators are rejected.

## Preview and undo

`--dry-run` scans and reports counts without creating folders, moving files, or adding history.

After an operation with successful moves, the source and destination paths are recorded in the user-specific history file at `~/.file-organizer-cli/history.json`. `file-organizer --undo` attempts to restore the most recent operation. Undo never overwrites an existing original path: such files are reported as skipped. Files that have been removed or changed since organization may not be restorable.

## Example output

```text
========================================
       FILE ORGANIZER CLI
========================================

Scanning directory: ./Downloads
✔ Images folder created
✔ Documents folder created

Organization completed!
Files scanned:    25
Files organized:  20
Files skipped:    3
Files failed:     2
Folders created:  Images, Documents
```

Colors and spinner animation are enabled in interactive terminals. Errors are shown with their affected paths; a nonzero exit status indicates a command-level failure.

## Development and tests

```sh
npm install
npm test
```

Tests use temporary directories and do not operate on personal files.

## Contributing

Please open an issue before a substantial change. Keep changes focused, add tests for behavior, and run `npm test` before submitting a pull request.

## License

MIT. See [LICENSE](./LICENSE).

## Publishing

The package is prepared for manual npm publication. Review the package metadata and version, then run:

```sh
npm pack --dry-run
npm login
npm publish
```

Publishing is intentionally not performed by this project setup.
