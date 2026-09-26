import { createReadStream } from 'node:fs';

/**
 * RFC 4180 rows as objects keyed by the header, streamed: the National Gallery
 * of Art's objects file is 82 MB, with quoted fields that hold commas, doubled
 * quotes and whole paragraphs across newlines. Rows whose width differs from
 * the header's are skipped rather than guessed at.
 */
export async function* csvRows(chunks) {
  let header = null;
  let row = [];
  let field = '';
  let quoted = false;
  let pendingQuote = false; // a quote seen inside a quoted field, meaning unknown until the next char
  // Streamed decoding, so a multi-byte character split across two chunks survives.
  const decoder = new TextDecoder();

  const endRow = function* () {
    row.push(field);
    field = '';
    if (!header) header = row;
    else if (row.length === header.length) yield Object.fromEntries(header.map((h, i) => [h, row[i]]));
    row = [];
  };

  for await (const chunk of chunks) {
    const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (pendingQuote) {
        pendingQuote = false;
        if (c === '"') {
          field += '"';
          continue;
        }
        quoted = false; // it closed the field; fall through to read c normally
      }
      if (quoted) {
        if (c === '"') pendingQuote = true;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') yield* endRow();
      else if (c !== '\r') field += c;
    }
  }
  if (pendingQuote) quoted = false;
  // A quote still open at the end is a torn file, not a row.
  if (!quoted && (field !== '' || row.length > 0)) yield* endRow();
}

export const csvFile = (file) => csvRows(createReadStream(file, { encoding: 'utf8' }));
