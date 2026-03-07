# Backup Scripts

Simple Deno backup scripts for file and folder backups.

## Run

- Backup: `deno task backup <config-path>`
- Restore: `deno task restore <backup-directory>`
- Test: `deno task test`

## Config format

```toml
backup-dir = "./backup_${os}_${date}_${count}"

[[tasks]]
src = ["/path/to/source"]
dest = "target"
```

## Backup behavior

The backup task supports these copy modes:

1. Single file to destination file
   - Example: `src = ["/a/file.txt"]`, `dest = "file.txt"`
   - Result: copied directly as `<backup-dir>/file.txt`

2. Single file to destination folder
   - Example: `src = ["/a/file.txt"]`, `dest = "files"`
   - Result: `<backup-dir>/files/file.txt`

3. Single folder to destination folder
   - Example: `src = ["/a/folder"]`, `dest = "folder-copy"`
   - Result: folder content is copied as `<backup-dir>/folder-copy/...`

4. Multiple files/folders (mixed) to destination folder
   - Example: `src = ["/a/file.txt", "/a/folder"]`, `dest = "bundle"`
   - Result: each source is copied under `<backup-dir>/bundle/`

5. Compression to 7zip
   - If destination ends with `.7z`, sources are compressed.
   - Example: `dest = "bundle.7z"`

## Optional fields

- `before-command` (array): commands to run before backup copy/compress
- `commands` (array, with `type = "command"`): command-only task
- `os` (array): run task only on matching OS
- `restore` (bool): include or skip this task during restore
- `filter-source` (bool): disable source filtering if set to `false`

## Example command-only task

```toml
[[tasks]]
type = "command"
commands = ["date > /tmp/backup-date.txt"]
```
