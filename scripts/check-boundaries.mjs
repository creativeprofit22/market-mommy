import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const failures = [];
let count = 0;
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Source symlinks are not supported');
    if (entry.isDirectory()) await visit(file);
    else if (entry.name.endsWith('.ts')) await inspect(file);
  }
}
async function inspect(file) {
  count++;
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const layer = relative.split('/')[0];
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function check(specifier) {
    if (!specifier || !ts.isStringLiteralLike(specifier)) {
      failures.push(`${relative}: computed imports are forbidden`);
      return;
    }
    const name = specifier.text;
    const local = name.startsWith('.');
    const target = local ? path.relative(root, path.resolve(path.dirname(file), name)).replaceAll('\\', '/') : name;
    if (local && (target.startsWith('../') || path.isAbsolute(target))) failures.push(`${relative}: source import escapes src`);
    if (name.includes('ggcoder') || name.includes('gg-coder')) failures.push(`${relative}: GG Coder internals are forbidden`);
    if (layer === 'domain' && !(local && target.startsWith('domain/')) && name !== 'zod') failures.push(`${relative}: domain dependency ${name}`);
    // The shared application input boundary uses the same pure schema library as domain.
    if (layer === 'application' && name !== 'zod' && !(local && /^(domain|application)\//.test(target))) failures.push(`${relative}: application dependency ${name}`);
    if (layer === 'adapters' && local && target.startsWith('interfaces/')) failures.push(`${relative}: adapter imports transport`);
    if (layer === 'interfaces' && local && target.startsWith('adapters/')) failures.push(`${relative}: transport bypasses composition/application`);
  }
  function walk(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) check(node.moduleSpecifier);
    }
    if (ts.isImportEqualsDeclaration(node)) failures.push(`${relative}: import-equals is forbidden`);
    if (ts.isImportTypeNode(node)) {
      if (ts.isLiteralTypeNode(node.argument)) check(node.argument.literal);
      else failures.push(`${relative}: computed import type`);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) check(node.arguments[0]);
    ts.forEachChild(node, walk);
  }
  walk(source);
}
await visit(root);
if (count === 0) failures.push('No source files checked');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log(`Import boundaries passed (${count} source files).`);
