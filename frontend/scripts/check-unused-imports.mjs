import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_DIR = path.resolve('src');
const EXTENSIONS = new Set(['.js', '.jsx']);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }

    if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function splitImportParts(value) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseNamedImports(specifier) {
  const body = specifier.replace(/^{|}$/g, '').trim();
  if (!body) return [];

  return splitImportParts(body).map((part) => {
    const aliasMatch = part.match(/^(.+?)\s+as\s+(.+)$/);
    return (aliasMatch ? aliasMatch[2] : part).trim();
  });
}

function parseImportLocals(importStatement) {
  const fromMatch = importStatement.match(/^import\s+([\s\S]+?)\s+from\s+['"][^'"]+['"]/);
  if (!fromMatch) return [];

  const specifier = fromMatch[1].trim();
  if (!specifier || specifier.startsWith('type ')) return [];

  if (specifier.startsWith('{')) {
    return parseNamedImports(specifier);
  }

  if (specifier.startsWith('*')) {
    const namespaceMatch = specifier.match(/\*\s+as\s+([\w$]+)/);
    return namespaceMatch ? [namespaceMatch[1]] : [];
  }

  const commaIndex = specifier.indexOf(',');
  if (commaIndex === -1) return [specifier.trim()];

  const locals = [specifier.slice(0, commaIndex).trim()];
  const rest = specifier.slice(commaIndex + 1).trim();

  if (rest.startsWith('{')) {
    locals.push(...parseNamedImports(rest));
  } else if (rest.startsWith('*')) {
    const namespaceMatch = rest.match(/\*\s+as\s+([\w$]+)/);
    if (namespaceMatch) locals.push(namespaceMatch[1]);
  }

  return locals.filter(Boolean);
}

function findUnusedImports(source) {
  const importRegex = /import\s+(?:(?:[\w${}\s,*]+)\s+from\s+['"][^'"]+['"]|['"][^'"]+['"]);?/g;
  const imports = [...source.matchAll(importRegex)].map((match) => match[0]);
  const sourceWithoutImports = source.replace(importRegex, '');
  const unused = [];

  for (const importStatement of imports) {
    for (const localName of parseImportLocals(importStatement)) {
      const usageRegex = new RegExp(`(^|[^\\w$])${escapeRegExp(localName)}([^\\w$]|$)`);
      if (!usageRegex.test(sourceWithoutImports)) {
        unused.push(localName);
      }
    }
  }

  return unused;
}

const files = await walk(SOURCE_DIR);
const findings = [];

for (const file of files) {
  const source = await fs.readFile(file, 'utf8');
  const unused = findUnusedImports(source);
  if (unused.length) {
    findings.push({ file, unused });
  }
}

if (findings.length) {
  console.error('Unused imports detected:');
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.unused.join(', ')}`);
  }
  process.exit(1);
}

console.log(`Unused import check passed (${files.length} files).`);
