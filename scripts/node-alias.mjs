// Lets plain Node run the app's TypeScript from scripts/: maps "@/x" to src/x and adds
// ".ts" / ".tsx" / "/index.ts" to extensionless imports. Use with:
//   node --import ./scripts/register.mjs scripts/<script>.ts
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const tryFile = (base) => {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of ['.ts', '.tsx', '/index.ts']) if (existsSync(base + ext)) return base + ext;
  return null;
};

export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith('@/')) base = path.join(SRC, specifier.slice(2));
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  const file = base && tryFile(base);
  if (file) return next(pathToFileURL(file).href, context);
  return next(specifier, context);
}
