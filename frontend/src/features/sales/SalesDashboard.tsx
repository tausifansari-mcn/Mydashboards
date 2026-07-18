import { useState, createContext, useContext, useEffect } from 'react';
import { BarChart3, Upload, Package, ArrowLeft, Database } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import BellavitaUpload from './BellavitaUpload';
import BellavitaAprUpload from './BellavitaAprUpload';
import BellavitaChatUpload from './BellavitaChatUpload';
import BellavitaCartUpload from './BellavitaCartUpload';
import BellavitaDashboard from './BellavitaDashboard';
import GncUpload from './GncUpload';
import GncAprUpload from './GncAprUpload';
import GncAllocationUpload from './GncAllocationUpload';
import NeemansCartUpload from './NeemansCartUpload';
import NeemansSaleUpload from './NeemansSaleUpload';
import NeemansAllocationUpload from './NeemansAllocationUpload';
import NeemansAprUpload from './NeemansAprUpload';
import NeemansDashboard from './NeemansDashboard';

type Brand = 'bellavita' | 'gnc' | 'neemans';
type Section = 'dashboards' | 'uploader';
type BellavitaUploadType = 'sale' | 'apr' | 'chat' | 'cart';
type GncUploadType = 'sale' | 'apr' | 'allocation';
type NeemansUploadType = 'cart' | 'sale' | 'allocation' | 'apr';

const BRAND_THEMES: Record<Brand, { color: string; lightBg: string; label: string }> = {
  bellavita: { color: '#1A1A1A', lightBg: '#F0F0F0', label: 'Bellavita' },
  gnc:       { color: '#ED1C24', lightBg: '#FFE0E0', label: 'GNC' },
  neemans:   { color: '#2D6A4F', lightBg: '#D8F3DC', label: 'Neemans' },
};

const BRANDS: { key: Brand; label: string; desc: string }[] = [
  { key: 'bellavita', label: 'Bellavita', desc: 'Manage Bellavita sale data' },
  { key: 'gnc',       label: 'GNC',       desc: 'Manage GNC sale data' },
  { key: 'neemans',   label: 'Neemans',   desc: 'Manage Neemans sale data' },
];

const SECTIONS: { key: Section; icon: typeof BarChart3; label: string; desc: string }[] = [
  { key: 'dashboards', icon: BarChart3, label: 'Dashboards',   desc: 'View charts and analytics' },
  { key: 'uploader',   icon: Upload,    label: 'Data Uploader', desc: 'Upload CSV or Excel files' },
];

const BELLAVITA_UPLOAD_TYPES: { key: BellavitaUploadType; label: string; desc: string }[] = [
  { key: 'sale', label: 'Sale Data', desc: 'Upload Bellavita sale data' },
  { key: 'apr',  label: 'APR Data',  desc: 'Upload Bellavita APR data' },
  { key: 'chat', label: 'Chat Data', desc: 'Upload Bellavita chat data' },
  { key: 'cart', label: 'Cart Data', desc: 'Upload Bellavita cart data' },
];

const GNC_UPLOAD_TYPES: { key: GncUploadType; label: string; desc: string }[] = [
  { key: 'sale',       label: 'Sale Data',       desc: 'Upload GNC sale data' },
  { key: 'apr',        label: 'APR Data',        desc: 'Upload GNC APR data' },
  { key: 'allocation', label: 'Allocation Data', desc: 'Upload GNC allocation data' },
];

const NEEMANS_UPLOAD_TYPES: { key: NeemansUploadType; label: string; desc: string }[] = [
  { key: 'sale',       label: 'Sale Raw Data',   desc: 'Upload Neemans raw sale records' },
  { key: 'allocation', label: 'Allocation Data', desc: 'Upload Neemans allocation / calling data' },
  { key: 'cart',       label: 'Cart Data',       desc: 'Upload Neemans cart / abandoned cart data' },
  { key: 'apr',        label: 'APR Data',        desc: 'Upload Neemans Agent Performance Report' },
];

const BrandAccentCtx = createContext('#10B981');

export function useBrandAccent() {
  return useContext(BrandAccentCtx);
}

export default function SalesDashboard() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const [allowedBrands,    setAllowedBrands]    = useState<string[] | null>(null);
  const [allowedUploaders, setAllowedUploaders] = useState<string[] | null>(null);

  useEffect(() => {
    if (isSuperAdmin) { setAllowedBrands(null); setAllowedUploaders(null); return; }
    Promise.all([
      api.get<string[]>('/auth/me/sale-brands'),
      api.get<string[]>('/auth/me/sale-uploader-brands'),
    ])
      .then(([b, u]) => { setAllowedBrands(b.data); setAllowedUploaders(u.data); })
      .catch(() => { setAllowedBrands([]); setAllowedUploaders([]); });
  }, [isSuperAdmin]);

  const visibleBrands = BRANDS.filter((b) =>
    isSuperAdmin || allowedBrands === null || allowedBrands.includes(b.key)
  );

  const [brand, setBrand] = useState<Brand | null>(null);

  // Auto-select brand when user has access to exactly one
  useEffect(() => {
    if (!brand && visibleBrands.length === 1) {
      setBrand(visibleBrands[0].key);
    }
  }, [visibleBrands.length]);

  const [section,            setSection]            = useState<Section | null>(null);
  const [bellavitaUploadType, setBellavitaUploadType] = useState<BellavitaUploadType | null>(null);
  const [gncUploadType,       setGncUploadType]       = useState<GncUploadType | null>(null);
  const [neemansUploadType,   setNeemansUploadType]   = useState<NeemansUploadType | null>(null);

  const brandData  = BRANDS.find((b) => b.key === brand);
  const theme      = brand ? BRAND_THEMES[brand] : null;
  const accentColor = theme?.color ?? '#10B981';
  const lightBg    = theme?.lightBg ?? '#ECFDF5';

  function getBackLabel(): string {
    if (brand === 'bellavita' && bellavitaUploadType) return `Bellavita / Data Uploader / ${BELLAVITA_UPLOAD_TYPES.find(t => t.key === bellavitaUploadType)?.label}`;
    if (brand === 'gnc' && gncUploadType)             return `GNC / Data Uploader / ${GNC_UPLOAD_TYPES.find(t => t.key === gncUploadType)?.label}`;
    if (brand === 'neemans' && neemansUploadType)     return `Neemans / Data Uploader / ${NEEMANS_UPLOAD_TYPES.find(t => t.key === neemansUploadType)?.label ?? neemansUploadType}`;
    if (section) return `${brandData?.label} / ${SECTIONS.find((s) => s.key === section)?.label}`;
    return 'All brands';
  }

  function goBack() {
    if (bellavitaUploadType) { setBellavitaUploadType(null); return; }
    if (gncUploadType)       { setGncUploadType(null);       return; }
    if (neemansUploadType)   { setNeemansUploadType(null);   return; }
    if (section)             { setSection(null);             return; }
    setBrand(null);
  }

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
             style={{ backgroundColor: lightBg }}>
          <Package className="h-5 w-5" style={{ color: accentColor }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Sales Dashboard</h1>
          <p className="text-xs text-slate-500">Upload and manage brand sale data</p>
        </div>
      </div>

      {(brand || section || bellavitaUploadType || gncUploadType || neemansUploadType) && (
        <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft size={15} />
          {getBackLabel()}
        </button>
      )}

      {/* No brand access state */}
      {!brand && allowedBrands !== null && !isSuperAdmin && visibleBrands.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Package className="h-12 w-12 mb-3 opacity-30" />
          <p className="font-semibold text-slate-600">No brand access</p>
          <p className="text-sm mt-1">Contact your administrator to get access to a sales brand dashboard.</p>
        </div>
      )}

      {/* Brand selector */}
      {!brand && visibleBrands.length > 1 && (
        <div className="grid grid-cols-2 gap-4">
          {visibleBrands.map((b) => {
            const c  = BRAND_THEMES[b.key].color;
            const bg = BRAND_THEMES[b.key].lightBg;
            return (
              <button key={b.key} onClick={() => setBrand(b.key)}
                className="rounded-2xl border border-slate-200 bg-white p-8 text-left transition-all"
                onMouseEnter={e => { e.currentTarget.style.borderColor = c; e.currentTarget.style.boxShadow = `0 4px 12px ${c}20`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
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

      {/* Section selector (Dashboards / Uploader) */}
      {brand && !section && (
        <div className="grid grid-cols-2 gap-4">
          {SECTIONS.filter((s) =>
            s.key !== 'uploader' ||
            isSuperAdmin ||
            allowedUploaders === null ||
            allowedUploaders.includes(brand)
          ).map((s) => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className="rounded-2xl border border-slate-200 bg-white p-8 text-left transition-all"
              onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}20`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                   style={{ backgroundColor: lightBg }}>
                <s.icon className="h-6 w-6" style={{ color: accentColor }} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{s.label}</h2>
              <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Bellavita upload type selector */}
      {brand === 'bellavita' && section === 'uploader' && !bellavitaUploadType && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {BELLAVITA_UPLOAD_TYPES.map((t) => (
            <button key={t.key} onClick={() => setBellavitaUploadType(t.key)}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all"
              onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}20`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg mb-3"
                   style={{ backgroundColor: lightBg }}>
                <Database className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{t.label}</h3>
              <p className="text-xs text-slate-500 mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* GNC upload type selector */}
      {brand === 'gnc' && section === 'uploader' && !gncUploadType && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          {GNC_UPLOAD_TYPES.map((t) => (
            <button key={t.key} onClick={() => setGncUploadType(t.key)}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all"
              onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}20`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg mb-3"
                   style={{ backgroundColor: lightBg }}>
                <Database className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{t.label}</h3>
              <p className="text-xs text-slate-500 mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Neemans upload type selector */}
      {brand === 'neemans' && section === 'uploader' && !neemansUploadType && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          {NEEMANS_UPLOAD_TYPES.map((t) => (
            <button key={t.key} onClick={() => setNeemansUploadType(t.key)}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all"
              onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}20`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg mb-3"
                   style={{ backgroundColor: lightBg }}>
                <Database className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{t.label}</h3>
              <p className="text-xs text-slate-500 mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Upload pages */}
      <BrandAccentCtx.Provider value={accentColor}>
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'sale' && <div className="mt-6"><BellavitaUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'apr'  && <div className="mt-6"><BellavitaAprUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'chat' && <div className="mt-6"><BellavitaChatUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'cart' && <div className="mt-6"><BellavitaCartUpload /></div>}
        {brand === 'gnc'       && section === 'uploader' && gncUploadType === 'sale'       && <div className="mt-6"><GncUpload /></div>}
        {brand === 'gnc'       && section === 'uploader' && gncUploadType === 'apr'        && <div className="mt-6"><GncAprUpload /></div>}
        {brand === 'gnc'       && section === 'uploader' && gncUploadType === 'allocation' && <div className="mt-6"><GncAllocationUpload /></div>}
        {brand === 'neemans'   && section === 'uploader' && neemansUploadType === 'cart'       && <div className="mt-6"><NeemansCartUpload /></div>}
        {brand === 'neemans'   && section === 'uploader' && neemansUploadType === 'sale'       && <div className="mt-6"><NeemansSaleUpload /></div>}
        {brand === 'neemans'   && section === 'uploader' && neemansUploadType === 'allocation' && <div className="mt-6"><NeemansAllocationUpload /></div>}
        {brand === 'neemans'   && section === 'uploader' && neemansUploadType === 'apr'        && <div className="mt-6"><NeemansAprUpload /></div>}
      </BrandAccentCtx.Provider>

      {/* Dashboards */}
      {brand === 'bellavita' && section === 'dashboards' && (
        <div className="mt-6"><BellavitaDashboard /></div>
      )}

      {brand === 'neemans' && section === 'dashboards' && (
        <div className="mt-6"><NeemansDashboard /></div>
      )}

      {brand === 'gnc' && section === 'dashboards' && (
        <div className="mt-6 flex flex-col items-center justify-center py-20 text-slate-400">
          <BarChart3 size={40} className="mb-3 text-slate-300" />
          <p className="text-sm font-medium">GNC dashboards coming soon</p>
        </div>
      )}
    </div>
  );
}
