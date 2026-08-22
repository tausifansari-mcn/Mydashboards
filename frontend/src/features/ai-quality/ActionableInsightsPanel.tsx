import React, { useState, useMemo } from 'react';
import { Search, Download } from 'lucide-react';
import { INSIGHTS_DATA, type InsightRow } from './insights-data';

const PRIORITY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  Critical: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20' },
  High:     { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-600/20' },
  Medium:   { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-600/20' },
  Low:      { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-600/20' },
};

const CATEGORY_COLORS: Record<string, string> = {
  'Quality Performance': '#0EA5E9',
  'Fatal Analysis':      '#EF4444',
  'Potential Scam':      '#F97316',
  'Critical Signals':    '#EAB308',
  'Fraud & Data Security': '#8B5CF6',
  'CLAP Analysis':       '#F59E0B',
  'TNI Detection':       '#10B981',
};

function downloadCsv(rows: InsightRow[]) {
  const header = 'Process Name,LOB,Insight Name,What It Detects,Recommended Action,TAT,Priority,Responsible Team';
  const body = rows.map(r =>
    ['AI Quality Inbound', 'Inbound', r.name, r.detects, r.action, r.tat, r.priority, r.team]
      .map(c => `"${c.replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Inbound_Quality_Actionable_Insights.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ActionableInsightsPanel() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(INSIGHTS_DATA.map(r => r.category));
    return Array.from(cats);
  }, []);

  const filtered = useMemo(() => {
    let rows = INSIGHTS_DATA;
    if (activeCategory) rows = rows.filter(r => r.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.detects.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        r.team.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [activeCategory, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, InsightRow[]>();
    for (const r of filtered) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of INSIGHTS_DATA) m.set(r.category, (m.get(r.category) || 0) + 1);
    return m;
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Actionable Insights</h2>
          <p className="text-xs text-slate-500 mt-0.5">{INSIGHTS_DATA.length} insights across {categories.length} categories</p>
        </div>
        <button onClick={() => downloadCsv(filtered)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors">
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search insights..."
          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all" />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!activeCategory ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          All ({INSIGHTS_DATA.length})
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${activeCategory === cat ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            style={activeCategory === cat ? { backgroundColor: CATEGORY_COLORS[cat] || '#64748b' } : undefined}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] || '#64748b' }} />
            {cat} ({catCounts.get(cat) || 0})
          </button>
        ))}
      </div>

      {/* Insight cards grouped by category */}
      {grouped.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">No insights match your search.</div>
      )}

      {grouped.map(([cat, rows]) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] || '#64748b' }} />
            <h3 className="text-sm font-bold text-slate-800">{cat}</h3>
            <span className="text-[10px] text-slate-400 font-medium">{rows.length} insight{rows.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map((row, idx) => {
              const pc = PRIORITY_COLORS[row.priority] || PRIORITY_COLORS.Medium;
              const globalIdx = INSIGHTS_DATA.indexOf(row);
              const isExpanded = expandedCard === globalIdx;
              return (
                <div key={idx}
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setExpandedCard(isExpanded ? null : globalIdx)}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-xs font-bold text-slate-900 leading-tight flex-1">{row.name}</h4>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${pc.bg} ${pc.text} ${pc.ring}`}>
                      {row.priority}
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    <div>
                      <span className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Detects</span>
                      <p className="text-slate-700 mt-0.5 leading-relaxed">{row.detects}</p>
                    </div>

                    {isExpanded && (
                      <>
                        <div>
                          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Action</span>
                          <p className="text-slate-700 mt-0.5 leading-relaxed">{row.action}</p>
                        </div>
                        <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
                          <span className="text-[9px] font-semibold text-slate-500 uppercase">TAT</span>
                          <span className="text-[11px] font-bold text-slate-800">{row.tat}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-semibold text-slate-500 uppercase">Team</span>
                          <span className="text-[11px] text-slate-600">{row.team}</span>
                        </div>
                      </>
                    )}

                    {!isExpanded && (
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-[9px] font-semibold text-slate-400">TAT: <span className="text-slate-700">{row.tat}</span></span>
                        <span className="text-[9px] font-semibold text-slate-400">Team: <span className="text-slate-600">{row.team}</span></span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
