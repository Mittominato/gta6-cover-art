// Neon Coast Cover Studio — entry program (Node 22, standard library only).
// Hands the app in: copies the app/ folder and the screenshots/ folder
// from beside this file into the output directory (or $MAKEFUN_OUTPUT_DIR
// outside the grader), then writes /output/dossier.json with buildDossier
// from the vendored make.fun library. Deterministic: same inputs always
// produce the same output bytes, and it never touches the network.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Directory holding this file; app/ and screenshots/ live beside it.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name) {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  if (!existsSync(from)) {
    throw new Error(`missing ${name}/ beside main.ts — cannot build the entry`);
  }
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  return readdirSync(from).length;
}

mkdirSync(outputDir, { recursive: true });
if (!existsSync(join(repoRoot, 'app', 'index.html'))) {
  throw new Error('app/index.html is missing beside main.ts — cannot build the entry');
}
const appEntries = copyTree('app');
const shotEntries = existsSync(join(repoRoot, 'screenshots')) ? copyTree('screenshots') : 0;

// Caps from the bounty gate: the dossier text is capped at 160 KiB; the
// other caps refuse an entry the scorer would refuse (at most 4 shots,
// each at most 256 KiB; app/ at most 993 entries / 48 MiB; paths <= 1000).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

try {
  console.log(
    `Neon Coast Cover Studio: copied ${appEntries} app entries and ${shotEntries} screenshots, ` +
    `wrote dossier.json (${dossier.length} bytes) to ${outputDir}`,
  );
} catch (err) {
  console.error('Neon Coast Cover Studio: failed to write the entry:', err);
  process.exitCode = 1;
}
