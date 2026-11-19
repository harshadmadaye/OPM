// True when the module at importMetaUrl is the script Node was started with.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function isMain(importMetaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  return importMetaUrl === pathToFileURL(fs.realpathSync(entry)).href;
}
