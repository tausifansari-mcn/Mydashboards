import { useState } from 'react';
import { BarChart3, Upload, Package, ArrowLeft, Database } from 'lucide-react';
import BellavitaUpload from './BellavitaUpload';
import BellavitaAprUpload from './BellavitaAprUpload';
import BellavitaChatUpload from './BellavitaChatUpload';
import BellavitaCartUpload from './BellavitaCartUpload';
import GncUpload from './GncUpload';
import GncAprUpload from './GncAprUpload';
import GncAllocationUpload from './GncAllocationUpload';
import GncDashboard from './GncDashboard';

type Brand = 'bellavita' | 'gnc';
type Section = 'dashboards' | 'uploader';
type BellavitaUploadType = 'sale' | 'apr' | 'chat' | 'cart';
type GncUploadType = 'sale' | 'apr' | 'allocation';

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

export default function SalesDashboard() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [bellavitaUploadType, setBellavitaUploadType] = useState<BellavitaUploadType | null>(null);
  const [gncUploadType, setGncUploadType] = useState<GncUploadType | null>(null);

  const brandData = BRANDS.find((b) => b.key === brand);

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

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
          <Package className="h-5 w-5 text-emerald-600" />
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

      {/* Level 1: Brand selection */}
      {!brand && (
        <div className="grid grid-cols-2 gap-4">
          {BRANDS.map((b) => (
            <button key={b.key} onClick={() => setBrand(b.key)} className="rounded-2xl border border-slate-200 bg-white p-8 text-left hover:border-emerald-300 hover:shadow-md transition-all group">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 mb-4 group-hover:bg-emerald-200 transition-colors">
                <Package className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{b.label}</h2>
              <p className="text-xs text-slate-500 mt-1">{b.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Level 2: Section selection */}
      {brand && !section && (
        <div className="grid grid-cols-2 gap-4">
          {SECTIONS.map((s) => (
            <button key={s.key} onClick={() => setSection(s.key)} className="rounded-2xl border border-slate-200 bg-white p-8 text-left hover:border-emerald-300 hover:shadow-md transition-all group">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 mb-4 group-hover:bg-emerald-200 transition-colors">
                <s.icon className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{s.label}</h2>
              <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Level 3a: Bellavita uploader (shows sub-cards) */}
      {brand === 'bellavita' && section === 'uploader' && !bellavitaUploadType && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {BELLAVITA_UPLOAD_TYPES.map((t) => (
            <button key={t.key} onClick={() => setBellavitaUploadType(t.key)} className="rounded-2xl border border-slate-200 bg-white p-6 text-left hover:border-emerald-300 hover:shadow-md transition-all group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 mb-3 group-hover:bg-emerald-200 transition-colors">
                <Database className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{t.label}</h3>
              <p className="text-xs text-slate-500 mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Level 3b: GNC uploader (shows sub-cards) */}
      {brand === 'gnc' && section === 'uploader' && !gncUploadType && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          {GNC_UPLOAD_TYPES.map((t) => (
            <button key={t.key} onClick={() => setGncUploadType(t.key)} className="rounded-2xl border border-slate-200 bg-white p-6 text-left hover:border-emerald-300 hover:shadow-md transition-all group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 mb-3 group-hover:bg-emerald-200 transition-colors">
                <Database className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{t.label}</h3>
              <p className="text-xs text-slate-500 mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Level 4: Bellavita upload forms */}
      {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'sale' && <div className="mt-6"><BellavitaUpload /></div>}
      {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'apr' && <div className="mt-6"><BellavitaAprUpload /></div>}
      {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'chat' && <div className="mt-6"><BellavitaChatUpload /></div>}
      {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'cart' && <div className="mt-6"><BellavitaCartUpload /></div>}

      {/* Level 4: GNC upload forms */}
      {brand === 'gnc' && section === 'uploader' && gncUploadType === 'sale' && <div className="mt-6"><GncUpload /></div>}
      {brand === 'gnc' && section === 'uploader' && gncUploadType === 'apr' && <div className="mt-6"><GncAprUpload /></div>}
      {brand === 'gnc' && section === 'uploader' && gncUploadType === 'allocation' && <div className="mt-6"><GncAllocationUpload /></div>}

      {/* Dashboards placeholder */}
      {brand && section === 'dashboards' && (
        <div className="mt-6 flex flex-col items-center justify-center py-20 text-slate-400">
          <BarChart3 size={40} className="mb-3 text-slate-300" />
          <p className="text-sm font-medium">{brandData?.label} dashboards coming soon</p>
        </div>
      )}
    </div>
  );
}
