import { DEFAULT_MET_DEPARTMENTS } from './fetch-met-objects.mjs';
import { DEFAULT_CMA_TYPES } from './fetch-cma-artworks.mjs';
import { DEFAULT_RIJKS_SETS } from './fetch-rijks-records.mjs';
import { DEFAULT_NGA_CLASSES } from './fetch-nga-objects.mjs';
import { SOURCES } from './normalize-artwork.mjs';

// PowerShell reads an unquoted a,b,c as an array and passes it on joined by
// spaces ("--met-departments=11 6 14"), so single-word lists take either
// separator. Lists whose entries hold spaces ("Arms and Armor") need commas.
const wordList = (value) => value.split(value.includes(',') ? ',' : /\s+/).map((s) => s.trim()).filter(Boolean);
const numberList = (value) => value.split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
const phraseList = (value) => value.split(',').map((s) => s.trim()).filter(Boolean);

/**
 * `--source=` takes a comma list of museums; `both` still means the original
 * two, so the commands in old notes keep doing what they did.
 */
export function parseArgs(argv) {
  const args = {
    sources: [...SOURCES],
    limit: Infinity,
    metDepartments: DEFAULT_MET_DEPARTMENTS,
    metQueries: [],
    cmaTypes: DEFAULT_CMA_TYPES,
    rijksSets: DEFAULT_RIJKS_SETS,
    ngaClasses: DEFAULT_NGA_CLASSES,
    minutes: 0,
    refreshIds: argv.includes('--refresh-ids'),
  };
  for (const arg of argv) {
    const m = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!m) continue;
    const [, key, value] = m;
    if (key === 'source') args.sources = value === 'both' ? ['met', 'cma'] : wordList(value);
    else if (key === 'limit') args.limit = Number(value);
    else if (key === 'minutes') args.minutes = Number(value);
    else if (key === 'met-departments') args.metDepartments = numberList(value);
    else if (key === 'met-queries') args.metQueries = wordList(value);
    else if (key === 'cma-types') args.cmaTypes = phraseList(value);
    else if (key === 'rijks-sets') args.rijksSets = wordList(value);
    else if (key === 'nga-classes') args.ngaClasses = phraseList(value);
  }
  const unknown = args.sources.filter((s) => !SOURCES.includes(s));
  if (unknown.length > 0 || args.sources.length === 0) throw new Error(`bad --source: use a comma list of ${SOURCES.join(', ')}`);
  if (!(args.limit > 0)) throw new Error('--limit must be a positive number');
  if (!(args.minutes >= 0)) throw new Error('--minutes must be a positive number');
  if (args.metDepartments.length === 0) throw new Error('--met-departments must list department ids');
  return args;
}
