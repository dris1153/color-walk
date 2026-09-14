import { createReadStream, existsSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import readline from 'node:readline';

/**
 * One JSON record per line, appended and never rewritten. The old single-JSON
 * cache was rewritten every 50 objects, which at 60k objects means writing a
 * 148 MB file 1,200 times. Appending is also what makes a Ctrl+C safe: the run
 * can only ever tear the final line, which parsing drops.
 */

/** Records are `{ id, o }`; `o: null` marks an object the API says is gone. */
export const appendRecord = (file, record) => appendFile(file, `${JSON.stringify(record)}\n`);

export async function* readRecords(file) {
  if (!existsSync(file)) return;
  const rl = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line);
      } catch {
        // The torn last line of an interrupted run; nothing follows it.
      }
    }
  } finally {
    rl.close();
  }
}

/** Ids already cached, so a resumed run knows exactly what it still owes. */
export async function readIds(file) {
  const ids = new Set();
  for await (const record of readRecords(file)) {
    if (record?.id != null) ids.add(String(record.id));
  }
  return ids;
}
