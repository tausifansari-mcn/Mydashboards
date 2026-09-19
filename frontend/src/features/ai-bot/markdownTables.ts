// Shared with SimpleMarkdown.tsx's table-rendering logic — one definition of "what counts as a
// Markdown table row" so the rendered table and the downloadable CSV can never disagree.
export interface ParsedTable { header: string[]; rows: string[][] }

export function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}
export function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes('-');
}
export function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

export function parseMarkdownTables(content: string): ParsedTable[] {
  const lines = content.split('\n');
  const tables: ParsedTable[] = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(lines[i]);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      tables.push({ header, rows });
    } else {
      i++;
    }
  }
  return tables;
}
