import { useState, createContext, useContext } from 'react';
import { BarChart3, Upload, Package, ArrowLeft, Database } from 'lucide-react';
import BellavitaUpload from './BellavitaUpload';
import BellavitaAprUpload from './BellavitaAprUpload';
import BellavitaChatUpload from './BellavitaChatUpload';
import BellavitaCartUpload from './BellavitaCartUpload';
import BellavitaDashboard from './BellavitaDashboard';
import GncUpload from './GncUpload';
import GncAprUpload from './GncAprUpload';
import GncAllocationUpload from './GncAllocationUpload';

type Brand = 'bellavita' | 'gnc';
type Section = 'dashboards' | 'uploader';
type BellavitaUploadType = 'sale' | 'apr' | 'chat' | 'cart';
type GncUploadType = 'sale' | 'apr' | 'allocation';

const BRAND_THEMES: Record<Brand, { color: string; lightBg: string; label: string }> = {
  bellavita: { color: '#1A1A1A', lightBg: '#F0F0F0', label: 'Bellavita' },
  gnc:       { color: '#ED1C24', lightBg: '#FFE0E0', label: 'GNC' },
};

const BRANDS: { key: Brand; label: string; desc: string }[] = [
  { key: 'bellavita', label: 'Bellavita', desc: 'Manage Bellavita sale data' },
  { key: 'gnc', label: 'GNC', desc: 'Manage GNC sale data' },
];

const SECTIONS: { key: Section; icon: typeof BarChart3; label: string; desc: string }[] = [
  { key: 'dashboards', icon: BarChart3, label: 'Dashboards', desc: 'View charts and analytics' },
  { key: 'uploader', icon: Upload, label: 'Data Uploader', desc: 'Upload CSV or Excel files' },
];

const BELLAVITA_UPLOAD_TYPES: { key: BellavitaUploadType; label: string; desc: string }[] = [
  { key: 'sale', label: 'Sale Data', desc: 'Upload Bellavita sale data' },
  { key: 'apr', label: 'APR Data', desc: 'Upload Bellavita APR data' },
  { key: 'chat', label: 'Chat Data', desc: 'Upload Bellavita chat data' },
  { key: 'cart', label: 'Cart Data', desc: 'Upload Bellavita cart data' },
];

const GNC_UPLOAD_TYPES: { key: GncUploadType; label: string; desc: string }[] = [
  { key: 'sale', label: 'Sale Data', desc: 'Upload GNC sale data' },
  { key: 'apr', label: 'APR Data', desc: 'Upload GNC APR data' },
  { key: 'allocation', label: 'Allocation Data', desc: 'Upload GNC allocation data' },
];

const BrandAccentCtx = createContext('#10B981');

export function useBrandAccent() {
  return useContext(BrandAccentCtx);
}

export default function SalesDashboard() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [bellavitaUploadType, setBellavitaUploadType] = useState<BellavitaUploadType | null>(null);
  const [gncUploadType, setGncUploadType] = useState<GncUploadType | null>(null);

  const brandData = BRANDS.find((b) => b.key === brand);
  const theme = brand ? BRAND_THEMES[brand] : null;
  const accentColor = theme?.color ?? '#10B981';
  const lightBg = theme?.lightBg ?? '#ECFDF5';

  function getBackLabel(): string {
    if (brand === 'bellavita' && bellavitaUploadType) return `Bellavita / Data Uploader / ${BELLAVITA_UPLOAD_TYPES.find(t => t.key === bellavitaUploadType)?.label}`;
    if (brand === 'gnc' && gncUploadType) return `GNC / Data Uploader / ${GNC_UPLOAD_TYPES.find(t => t.key === gncUploadType)?.label}`;
    if (section) return `${brandData?.label} / ${SECTIONS.find((s) => s.key === section)?.label}`;
    return 'All brands';
  }

  function goBack() {
    if (bellavitaUploadType) { setBellavitaUploadType(null); return; }
    if (gncUploadType) { setGncUploadType(null); return; }
    if (section) { setSection(null); return; }
    setBrand(null);
  }

  function brandHover(b: Brand) {
    const c = BRAND_THEMES[b].color;
    return `hover:border-[${c}] hover:shadow-[0_4px_12px_${c}20]`;
  }

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl`}
             style={{ backgroundColor: lightBg }}>
          <Package className="h-5 w-5" style={{ color: accentColor }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Sales Dashboard</h1>
          <p className="text-xs text-slate-500">Upload and manage brand sale data</p>
        </div>
      </div>

      {(brand || section || bellavitaUploadType || gncUploadType) && (
        <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft size={15} />
          {getBackLabel()}
        </button>
      )}

      {!brand && (
        <div className="grid grid-cols-2 gap-4">
          {BRANDS.map((b) => {
            const c = BRAND_THEMES[b.key].color;
            const bg = BRAND_THEMES[b.key].lightBg;
            return (
              <button key={b.key} onClick={() => setBrand(b.key)}
                className="rounded-2xl border border-slate-200 bg-white p-8 text-left transition-all group"
                style={{ ['--brand-color' as string]: c }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = c; e.currentTarget.style.boxShadow = `0 4px 12px ${c}20`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4 transition-colors"
                     style={{ backgroundColor: bg }}>
                  <Package className="h-6 w-6" style={{ color: c }} />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{b.label}</h2>
                <p className="text-xs text-slate-500 mt-1">{b.desc}</p>
              </button>
            );
          })}
        </div>
      )}

      {brand && !section && (
        <div className="grid grid-cols-2 gap-4">
          {SECTIONS.map((s) => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className="rounded-2xl border border-slate-200 bg-white p-8 text-left transition-all group"
              onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}20`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4 transition-colors"
                   style={{ backgroundColor: lightBg }}>
                <s.icon className="h-6 w-6" style={{ color: accentColor }} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{s.label}</h2>
              <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {brand === 'bellavita' && section === 'uploader' && !bellavitaUploadType && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {BELLAVITA_UPLOAD_TYPES.map((t) => (
            <button key={t.key} onClick={() => setBellavitaUploadType(t.key)}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all group"
              onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}20`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg mb-3 transition-colors"
                   style={{ backgroundColor: lightBg }}>
                <Database className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{t.label}</h3>
              <p className="text-xs text-slate-500 mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      )}

      {brand === 'gnc' && section === 'uploader' && !gncUploadType && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          {GNC_UPLOAD_TYPES.map((t) => (
            <button key={t.key} onClick={() => setGncUploadType(t.key)}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all group"
              onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}20`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg mb-3 transition-colors"
                   style={{ backgroundColor: lightBg }}>
                <Database className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{t.label}</h3>
              <p className="text-xs text-slate-500 mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      )}

      <BrandAccentCtx.Provider value={accentColor}>
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'sale' && <div className="mt-6"><BellavitaUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'apr' && <div className="mt-6"><BellavitaAprUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'chat' && <div className="mt-6"><BellavitaChatUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'cart' && <div className="mt-6"><BellavitaCartUpload /></div>}
        {brand === 'gnc' && section === 'uploader' && gncUploadType === 'sale' && <div className="mt-6"><GncUpload /></div>}
        {brand === 'gnc' && section === 'uploader' && gncUploadType === 'apr' && <div className="mt-6"><GncAprUpload /></div>}
        {brand === 'gnc' && section === 'uploader' && gncUploadType === 'allocation' && <div className="mt-6"><GncAllocationUpload /></div>}
      </BrandAccentCtx.Provider>

      {brand === 'bellavita' && section === 'dashboards' && (
        <div className="mt-6"><BellavitaDashboard /></div>
      )}

      {brand === 'gnc' && section === 'dashboards' && (
        <div className="mt-6 flex flex-col items-center justify-center py-20 text-slate-400">
          <BarChart3 size={40} className="mb-3 text-slate-300" />
          <p className="text-sm font-medium">{brandData?.label} dashboards coming soon</p>
        </div>
      )}
    </div>
  );
}
