import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const defaultMappingPath = path.join(root, 'content', 'leetcode-links.json');
const defaultLibraryPath = path.join(root, 'content', 'library.json');

/** Preserve source titles and IDs while adding verified canonical practice links. */
export function applyLeetCodeLinks(problems, mapping) {
  return problems.map(problem => {
    const match = mapping.problems[problem.id];
    if (match) {
      return {
        ...problem,
        url: match.url,
        leetcodeId: match.number,
        leetcodeTitle: match.title,
        premium: match.premium,
        sourceUrl: problem.sourceUrl || mapping.sourceUrl,
      };
    }
    const reference = mapping.references[problem.id];
    if (reference) {
      const { url, leetcodeId, leetcodeTitle, premium, ...original } = problem;
      return { ...original, sourceUrl: reference.url, linkNote: reference.reason };
    }
    return { ...problem, sourceUrl: problem.sourceUrl || mapping.sourceUrl };
  });
}

export async function loadLeetCodeMapping(mappingPath = defaultMappingPath) {
  return JSON.parse(await fs.readFile(mappingPath, 'utf8'));
}

export async function linkLibrary(library, mappingPath = defaultMappingPath) {
  const mapping = await loadLeetCodeMapping(mappingPath);
  return { ...library, problems: applyLeetCodeLinks(library.problems || [], mapping) };
}

/** Optionally check every stored link against a downloaded official catalog. */
export function validateLeetCodeMapping(mapping, catalog) {
  const seen = new Set();
  for (const [id, problem] of Object.entries(mapping.problems)) {
    if (!Number.isInteger(problem.number) || problem.number < 1) throw new Error(`Invalid problem number for ${id}`);
    if (problem.url !== `https://leetcode.com/problems/${problem.slug}/`) throw new Error(`Invalid canonical URL for ${id}`);
    if (seen.has(problem.number)) throw new Error(`Duplicate LeetCode problem number: ${problem.number}`);
    seen.add(problem.number);
    if (catalog) {
      const official = catalog.stat_status_pairs.find(entry => entry.stat.frontend_question_id === problem.number);
      if (!official || official.stat.question__title_slug !== problem.slug || official.stat.question__title !== problem.title) {
        throw new Error(`Official catalog does not confirm ${id}: ${problem.url}`);
      }
    }
  }
  for (const [id, reference] of Object.entries(mapping.references)) {
    if (mapping.problems[id] || !reference.url || !reference.reason) throw new Error(`Invalid source reference for ${id}`);
  }
}

async function main() {
  const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const mapping = await loadLeetCodeMapping(option('mapping'));
  const catalogPath = option('catalog');
  const catalog = catalogPath ? JSON.parse(await fs.readFile(catalogPath, 'utf8')) : undefined;
  validateLeetCodeMapping(mapping, catalog);
  const libraryPath = option('library') || defaultLibraryPath;
  const library = JSON.parse(await fs.readFile(libraryPath, 'utf8'));
  const linked = { ...library, problems: applyLeetCodeLinks(library.problems || [], mapping) };
  const direct = linked.problems.filter(problem => mapping.problems[problem.id]);
  const references = linked.problems.filter(problem => mapping.references[problem.id]);
  const unresolved = linked.problems.filter(problem => !mapping.problems[problem.id] && !mapping.references[problem.id]);
  if (!process.argv.includes('--check') && !process.argv.includes('--dry-run')) {
    await fs.writeFile(libraryPath, `${JSON.stringify(linked, null, 2)}\n`);
  }
  console.log(JSON.stringify({
    checkedAgainstOfficialCatalog: Boolean(catalog),
    directLeetCodeLinks: direct.length,
    sourceReferences: references.map(problem => problem.title),
    unresolved: unresolved.map(problem => problem.title),
    wroteLibrary: !process.argv.includes('--check') && !process.argv.includes('--dry-run'),
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
