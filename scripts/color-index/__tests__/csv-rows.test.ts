import { describe, expect, it } from 'vitest';
import { csvRows } from '../csv-rows.mjs';

const collect = async (chunks: string[]) => {
  const out = [];
  for await (const row of csvRows(chunks)) out.push(row);
  return out;
};

describe('csvRows', () => {
  it('keys rows by the header and handles CRLF', async () => {
    expect(await collect(['a,b\r\n1,2\r\n3,4\r\n'])).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('keeps commas, doubled quotes and newlines inside quoted fields', async () => {
    const rows = await collect(['id,text\n1,"one, ""two""\nthree"\n2,plain\n']);
    expect(rows).toEqual([
      { id: '1', text: 'one, "two"\nthree' },
      { id: '2', text: 'plain' },
    ]);
  });

  it('does not care where the chunks break, even between a pair of quotes', async () => {
    const whole = 'id,text\n1,"say ""hi"""\n2,x\n';
    for (let cut = 1; cut < whole.length; cut++) {
      expect(await collect([whole.slice(0, cut), whole.slice(cut)])).toEqual([
        { id: '1', text: 'say "hi"' },
        { id: '2', text: 'x' },
      ]);
    }
  });

  it('reads a last row with no newline, and skips rows of the wrong width', async () => {
    expect(await collect(['a,b\n1,2,3\n4,5'])).toEqual([{ a: '4', b: '5' }]);
  });
});

describe('csvRows on byte chunks', () => {
  it('keeps a multi-byte character split across chunks', async () => {
    const bytes = new TextEncoder().encode('a\né€\n');
    const out = [];
    for await (const row of csvRows([bytes.slice(0, 4), bytes.slice(4)])) out.push(row);
    expect(out).toEqual([{ a: 'é€' }]);
  });

  it('drops a last row whose quote never closes', async () => {
    const out = [];
    for await (const row of csvRows(['a,b\n1,"torn'])) out.push(row);
    expect(out).toEqual([]);
  });
});
