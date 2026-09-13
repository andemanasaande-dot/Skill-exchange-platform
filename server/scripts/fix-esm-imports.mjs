import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const distDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const relativeImportPattern = /(\bfrom\s+['"]|\bimport\s*\(\s*['"])(\.{1,2}\/[^'"\n]+?)(['"])/g;

const hasExtension = (specifier) => /\.(?:js|json|node)$/.test(specifier);

const processDirectory = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await processDirectory(entryPath);
      return;
    }
    if (!entry.name.endsWith('.js')) return;

    const source = await readFile(entryPath, 'utf8');
    const updated = source.replace(relativeImportPattern, (match, prefix, specifier, suffix) => (
      hasExtension(specifier) ? match : `${prefix}${specifier}.js${suffix}`
    ));
    if (updated !== source) await writeFile(entryPath, updated);
  }));
};

await processDirectory(distDirectory);
