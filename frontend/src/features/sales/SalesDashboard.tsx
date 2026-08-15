import { useState, createContext, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Upload, Package, ArrowLeft, Receipt, Activity, MessageSquare,
  ShoppingCart, RefreshCw, PhoneCall, ChevronRight, Link2,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import BellavitaUpload from './BellavitaUpload';
import BellavitaAprUpload from './BellavitaAprUpload';
import BellavitaChatUpload from './BellavitaChatUpload';
import BellavitaCartUpload from './BellavitaCartUpload';
import BellavitaOrderExportUpload from './BellavitaOrderExportUpload';
import BellavitaRepeatCdrUpload from './BellavitaRepeatCdrUpload';
import BellavitaRepeatAllocationUpload from './BellavitaRepeatAllocationUpload';
import BellavitaRepeatAllocation from './BellavitaRepeatAllocation';
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
type Section = 'dashboards' | 'uploader' | 'repeatAllocation';
type BellavitaUploadType = 'sale' | 'apr' | 'chat' | 'cart' | 'orderExport' | 'repeatCdr' | 'repeatAllocation';
type GncUploadType = 'sale' | 'apr' | 'allocation';
type NeemansUploadType = 'cart' | 'sale' | 'allocation' | 'apr';
type IconType = typeof BarChart3;

const BRAND_THEMES: Record<Brand, { color: string; color2: string; label: string }> = {
  bellavita: { color: '#1A1A1A', color2: '#3F3F46', label: 'Bellavita' },
  gnc:       { color: '#ED1C24', color2: '#F97066', label: 'GNC' },
  neemans:   { color: '#2D6A4F', color2: '#40916C', label: 'Neemans' },
};

const BRANDS: { key: Brand; label: string; desc: string }[] = [
  { key: 'bellavita', label: 'Bellavita', desc: 'Manage Bellavita sale data' },
  { key: 'gnc',       label: 'GNC',       desc: 'Manage GNC sale data' },
  { key: 'neemans',   label: 'Neemans',   desc: 'Manage Neemans sale data' },
];

const SECTIONS: { key: Section; icon: IconType; label: string; desc: string; brandOnly?: Brand }[] = [
  { key: 'dashboards', icon: BarChart3, label: 'Dashboards',   desc: 'View charts and analytics' },
  { key: 'uploader',   icon: Upload,    label: 'Data Uploader', desc: 'Upload CSV or Excel files' },
  { key: 'repeatAllocation', icon: Link2, label: 'Repeat Allocation', desc: 'Match OrderExport with Repeat CDR and download data', brandOnly: 'bellavita' },
];

const BELLAVITA_UPLOAD_TYPES: { key: BellavitaUploadType; icon: IconType; label: string; desc: string }[] = [
  { key: 'sale',        icon: Receipt,       label: 'Sale Data',              desc: 'Upload Bellavita sale data' },
  { key: 'apr',         icon: Activity,      label: 'APR Data',               desc: 'Upload Bellavita APR data' },
  { key: 'chat',        icon: MessageSquare, label: 'Chat Data',              desc: 'Upload Bellavita chat data' },
  { key: 'cart',        icon: ShoppingCart,  label: 'Cart Data',              desc: 'Upload Bellavita cart data' },
  { key: 'orderExport', icon: RefreshCw,     label: 'OrderExport For Repeat', desc: 'Shopify order export for repeat customer analysis' },
  { key: 'repeatCdr',   icon: PhoneCall,     label: 'Repeat CDR',             desc: 'Repeat call-detail records (Phone, Status, Agent)' },
  { key: 'repeatAllocation', icon: Package,  label: 'Repeat Allocation',      desc: 'Upload repeat allocation rows (Unique, Mobile, Email, Order)' },
];

const GNC_UPLOAD_TYPES: { key: GncUploadType; icon: IconType; label: string; desc: string }[] = [
  { key: 'sale',       icon: Receipt,  label: 'Sale Data',       desc: 'Upload GNC sale data' },
  { key: 'apr',        icon: Activity, label: 'APR Data',        desc: 'Upload GNC APR data' },
  { key: 'allocation', icon: Package,  label: 'Allocation Data', desc: 'Upload GNC allocation data' },
];

const NEEMANS_UPLOAD_TYPES: { key: NeemansUploadType; icon: IconType; label: string; desc: string }[] = [
  { key: 'sale',       icon: Receipt,      label: 'Sale Raw Data',   desc: 'Upload Neemans raw sale records' },
  { key: 'allocation', icon: Package,      label: 'Allocation Data', desc: 'Upload Neemans allocation / calling data' },
  { key: 'cart',       icon: ShoppingCart, label: 'Cart Data',       desc: 'Upload Neemans cart / abandoned cart data' },
  { key: 'apr',        icon: Activity,     label: 'APR Data',        desc: 'Upload Neemans Agent Performance Report' },
];

const BrandAccentCtx = createContext('#10B981');

export function useBrandAccent() {
  return useContext(BrandAccentCtx);
}

// ─── Shared animated tile grid ──────────────────────────────────────────────
const gridVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const tileVariants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } };

function TileGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <motion.div
      variants={gridVariants} initial="hidden" animate="show"
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${cols === 3 ? 'lg:grid-cols-3' : ''}`}
    >
      {children}
    </motion.div>
  );
}

function Tile({
  icon: Icon, label, desc, accent, accent2, onClick, big,
}: {
  icon: IconType; label: string; desc: string; accent: string; accent2: string;
  onClick: () => void; big?: boolean;
}) {
  return (
    <motion.button
      variants={tileVariants}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition-shadow duration-300 hover:shadow-xl ${big ? 'p-8' : 'p-6'}`}
      style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}
    >
      {/* Diagonal accent glow, appears on hover */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent2})` }}
      />
      <div className={`relative flex items-center justify-center rounded-xl shrink-0 ${big ? 'h-12 w-12 mb-4' : 'h-10 w-10 mb-3'}`}
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent2})` }}>
        <Icon className={big ? 'h-6 w-6' : 'h-5 w-5'} style={{ color: '#fff' }} />
      </div>
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <h3 className={`font-bold text-slate-900 ${big ? 'text-lg' : 'text-sm'}`}>{label}</h3>
          <p className={`text-slate-500 mt-1 ${big ? 'text-xs' : 'text-xs'}`}>{desc}</p>
        </div>
        <ChevronRight size={16} className="mt-1 shrink-0 text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-slate-400" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent2})` }} />
    </motion.button>
  );
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
  const accentColor  = theme?.color ?? '#10B981';
  const accentColor2 = theme?.color2 ?? '#34D399';

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
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm"
             style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor2})` }}>
          <Package className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Sales Dashboard</h1>
          <p className="text-xs text-slate-500">Upload and manage brand sale data</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {(brand || section || bellavitaUploadType || gncUploadType || neemansUploadType) && (
          <motion.button
            key="back"
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 mb-4 transition-colors"
          >
            <ArrowLeft size={15} />
            {getBackLabel()}
          </motion.button>
        )}
      </AnimatePresence>

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
        <TileGrid>
          {visibleBrands.map((b) => {
            const t = BRAND_THEMES[b.key];
            return (
              <Tile key={b.key} big icon={Package} label={b.label} desc={b.desc}
                accent={t.color} accent2={t.color2} onClick={() => setBrand(b.key)} />
            );
          })}
        </TileGrid>
      )}

      {/* Section selector (Dashboards / Uploader) */}
      {brand && !section && (
        <TileGrid>
          {SECTIONS.filter((s) =>
            (!s.brandOnly || s.brandOnly === brand) &&
            (s.key !== 'uploader' ||
              isSuperAdmin ||
              allowedUploaders === null ||
              allowedUploaders.includes(brand))
          ).map((s) => (
            <Tile key={s.key} big icon={s.icon} label={s.label} desc={s.desc}
              accent={accentColor} accent2={accentColor2} onClick={() => setSection(s.key)} />
          ))}
        </TileGrid>
      )}

      {/* Bellavita upload type selector */}
      {brand === 'bellavita' && section === 'uploader' && !bellavitaUploadType && (
        <div className="mt-2">
          <TileGrid cols={3}>
            {BELLAVITA_UPLOAD_TYPES.map((t) => (
              <Tile key={t.key} icon={t.icon} label={t.label} desc={t.desc}
                accent={accentColor} accent2={accentColor2} onClick={() => setBellavitaUploadType(t.key)} />
            ))}
          </TileGrid>
        </div>
      )}

      {/* GNC upload type selector */}
      {brand === 'gnc' && section === 'uploader' && !gncUploadType && (
        <div className="mt-2">
          <TileGrid cols={3}>
            {GNC_UPLOAD_TYPES.map((t) => (
              <Tile key={t.key} icon={t.icon} label={t.label} desc={t.desc}
                accent={accentColor} accent2={accentColor2} onClick={() => setGncUploadType(t.key)} />
            ))}
          </TileGrid>
        </div>
      )}

      {/* Neemans upload type selector */}
      {brand === 'neemans' && section === 'uploader' && !neemansUploadType && (
        <div className="mt-2">
          <TileGrid cols={3}>
            {NEEMANS_UPLOAD_TYPES.map((t) => (
              <Tile key={t.key} icon={t.icon} label={t.label} desc={t.desc}
                accent={accentColor} accent2={accentColor2} onClick={() => setNeemansUploadType(t.key)} />
            ))}
          </TileGrid>
        </div>
      )}

      {/* Upload pages */}
      <BrandAccentCtx.Provider value={accentColor}>
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'sale' && <div className="mt-6"><BellavitaUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'apr'  && <div className="mt-6"><BellavitaAprUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'chat' && <div className="mt-6"><BellavitaChatUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'cart' && <div className="mt-6"><BellavitaCartUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'orderExport' && <div className="mt-6"><BellavitaOrderExportUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'repeatCdr' && <div className="mt-6"><BellavitaRepeatCdrUpload /></div>}
        {brand === 'bellavita' && section === 'uploader' && bellavitaUploadType === 'repeatAllocation' && <div className="mt-6"><BellavitaRepeatAllocationUpload /></div>}
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

      {brand === 'bellavita' && section === 'repeatAllocation' && (
        <div className="mt-6"><BellavitaRepeatAllocation /></div>
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
