import { Fragment } from 'react';
import { isTableRow, isTableSeparator, splitRow } from './markdownTables';

// A small, dependency-free renderer for the common subset of Markdown an LLM naturally produces
// in a data report: headings, bold, bullet/numbered lists, and GFM-style tables. Not a general
// Markdown engine — just enough that "agent-wise CQ report" style answers (which the model
// formats as tables) render as an actual table instead of literal pipe characters and asterisks.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });
}

export function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table: a header row, a separator row, then data rows
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>{header.map((h, hi) => <th key={hi} className="px-2.5 py-1.5 text-left font-bold text-slate-600 border-b border-slate-200">{renderInline(h, `h${hi}`)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, ri) => (
                <tr key={ri} className="hover:bg-slate-50/60">
                  {r.map((c, ci) => <td key={ci} className="px-2.5 py-1.5 text-slate-700">{renderInline(c, `r${ri}c${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const sizeClass = level <= 2 ? 'text-sm font-bold' : 'text-xs font-bold';
      blocks.push(<p key={key++} className={`${sizeClass} text-slate-900 mt-2 mb-1`}>{renderInline(headingMatch[2], `hd${key}`)}</p>);
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, '')); i++; }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 my-1 space-y-0.5">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `li${ii}`)}</li>)}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s+/, '')); i++; }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 my-1 space-y-0.5">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `oli${ii}`)}</li>)}
        </ol>
      );
      continue;
    }

    // Blank line — paragraph break
    if (line.trim() === '') { i++; continue; }

    // Plain paragraph line
    blocks.push(<p key={key++} className="leading-relaxed">{renderInline(line, `p${key}`)}</p>);
    i++;
  }

  return <div className="space-y-1">{blocks}</div>;
}
