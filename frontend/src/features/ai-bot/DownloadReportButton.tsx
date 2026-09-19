import { Download } from 'lucide-react';
import { parseMarkdownTables } from './markdownTables';

function toCsvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function DownloadReportButton({ content }: { content: string }) {
  const tables = parseMarkdownTables(content);
  if (tables.length === 0) return null;

  const handleDownload = () => {
    const csv = tables
      .map((t, i) => {
        const body = [t.header, ...t.rows].map(r => r.map(toCsvCell).join(',')).join('\n');
        return tables.length > 1 ? `Table ${i + 1}\n${body}` : body;
      })
      .join('\n\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cam-bot-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={handleDownload}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
      <Download size={12} /> Download report (CSV)
    </button>
  );
}
