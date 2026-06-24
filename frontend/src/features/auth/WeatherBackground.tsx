import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';

type WeatherType = 'sunny' | 'partly_cloudy' | 'cloudy' | 'windy' | 'rainy' | 'stormy';

interface WeatherState {
  type: WeatherType;
  isDay: boolean;
  temp: number | null;
  city: string;
  windSpeed: number;
}

function wmoToType(code: number, windKph: number): WeatherType {
  if (windKph > 45) return 'windy';
  if (code >= 95) return 'stormy';
  if (code >= 51 && code <= 82) return 'rainy';
  if (code >= 45 && code <= 48) return 'cloudy';
  if (windKph > 30) return 'windy';
  if (code === 3) return 'cloudy';
  if (code === 2) return 'partly_cloudy';
  if (code <= 1) return 'sunny';
  return 'partly_cloudy';
}

const SKY: Record<string, string> = {
  sunny_1:         'linear-gradient(180deg,#0B4FA6 0%,#1E88E5 40%,#7EC8FA 75%,#FFF3E0 100%)',
  partly_cloudy_1: 'linear-gradient(180deg,#1565C0 0%,#42A5F5 55%,#90CAF9 100%)',
  cloudy_1:        'linear-gradient(180deg,#546E7A 0%,#78909C 50%,#B0BEC5 100%)',
  windy_1:         'linear-gradient(180deg,#263238 0%,#455A64 55%,#607D8B 100%)',
  rainy_1:         'linear-gradient(180deg,#1A237E 0%,#283593 45%,#3949AB 100%)',
  stormy_1:        'linear-gradient(180deg,#060606 0%,#12121E 55%,#1C1C2E 100%)',
  sunny_0:         'linear-gradient(180deg,#020818 0%,#06122A 40%,#0A1A3A 100%)',
  partly_cloudy_0: 'linear-gradient(180deg,#030B1A 0%,#0A1628 50%,#112240 100%)',
  cloudy_0:        'linear-gradient(180deg,#1A202C 0%,#2D3748 50%,#4A5568 100%)',
  windy_0:         'linear-gradient(180deg,#0A0A0A 0%,#151520 50%,#1C1C2E 100%)',
  rainy_0:         'linear-gradient(180deg,#080812 0%,#101025 50%,#181830 100%)',
  stormy_0:        'linear-gradient(180deg,#030303 0%,#080812 50%,#0D0D1A 100%)',
};

function skyGrad(type: WeatherType, isDay: boolean) {
  return SKY[`${type}_${isDay ? 1 : 0}`] ?? SKY.partly_cloudy_1;
}

/* ── CSS keyframes ─────────────────────────────────────────────────────────── */
const CSS_ANIM = `
@keyframes cloudDrift {
  from { transform: translateX(110vw); }
  to   { transform: translateX(-440px); }
}
@keyframes rainDrop {
  0%   { transform: translateY(-40px) rotate(12deg); opacity: 0; }
  8%   { opacity: 0.8; }
  100% { transform: translateY(105vh) rotate(12deg); opacity: 0.3; }
}
@keyframes leafFly {
  0%   { transform: translateX(108vw) translateY(0px) rotate(0deg); opacity: 0; }
  6%   { opacity: 1; }
  45%  { transform: translateX(58vw) translateY(70px) rotate(210deg); }
  80%  { transform: translateX(18vw) translateY(-25px) rotate(350deg); }
  96%  { opacity: 0.9; }
  100% { transform: translateX(-180px) translateY(15px) rotate(420deg); opacity: 0; }
}
@keyframes sunRay  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes sunGlow { 0%,100% { transform: scale(1); } 50% { transform: scale(1.07); } }
@keyframes starBlink { 0%,100% { opacity: 0.15; } 50% { opacity: 1; } }
`;

/* ── Stars ─────────────────────────────────────────────────────────────────── */
function Stars({ visible }: { visible: boolean }) {
  const stars = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    id: i,
    x:   Math.random() * 100,
    y:   Math.random() * 65,
    sz:  1 + Math.random() * 1.8,
    dur: 1.5 + Math.random() * 3,
    del: Math.random() * 4,
  })), []);
  if (!visible) return null;
  return <>
    {stars.map(s => (
      <div key={s.id} style={{
        position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
        width: s.sz, height: s.sz, borderRadius: '50%', background: 'white',
        animation: `starBlink ${s.dur}s ease-in-out infinite ${s.del}s`,
        zIndex: 1,
      }} />
    ))}
  </>;
}

/* ── Moon ──────────────────────────────────────────────────────────────────── */
function Moon({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <motion.div
      style={{ position: 'absolute', top: '7%', right: '12%', zIndex: 3, filter: 'drop-shadow(0 0 18px rgba(255,249,196,0.4))' }}
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg width="68" height="68" viewBox="0 0 68 68">
        <defs>
          <radialGradient id="moonG" cx="38%" cy="32%">
            <stop offset="0%" stopColor="#FFF9C4" />
            <stop offset="100%" stopColor="#FFF176" />
          </radialGradient>
          <mask id="moonM">
            <circle cx="34" cy="34" r="30" fill="white" />
            <circle cx="50" cy="20" r="24" fill="black" />
          </mask>
        </defs>
        <circle cx="34" cy="34" r="30" fill="url(#moonG)" mask="url(#moonM)" />
      </svg>
    </motion.div>
  );
}

/* ── Sun ───────────────────────────────────────────────────────────────────── */
function Sun({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div style={{ position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
      {/* outer glow */}
      <div style={{
        position: 'absolute', top: -30, left: -30, width: 180, height: 180, borderRadius: '50%',
        background: 'radial-gradient(circle,rgba(255,236,64,.28) 0%,rgba(255,193,7,.1) 50%,transparent 70%)',
        animation: 'sunGlow 4s ease-in-out infinite',
      }} />
      {/* rotating rays */}
      <div style={{
        position: 'absolute', top: -20, left: -20, width: 160, height: 160,
        animation: 'sunRay 22s linear infinite', zIndex: 1,
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 2, height: 46,
            background: 'linear-gradient(to bottom,rgba(255,235,59,.9),transparent)',
            borderRadius: 2,
            transformOrigin: '50% 0',
            transform: `rotate(${i * 30}deg) translateX(-50%) translateY(-86px)`,
          }} />
        ))}
      </div>
      {/* core */}
      <div style={{
        width: 120, height: 120, borderRadius: '50%', position: 'relative', zIndex: 2,
        background: 'radial-gradient(circle at 38% 35%,#FFF9C4 0%,#FFE082 40%,#FFD600 100%)',
        boxShadow: '0 0 50px 20px rgba(255,214,0,.55),0 0 100px 50px rgba(255,193,7,.22)',
        animation: 'sunGlow 4s ease-in-out infinite',
      }} />
    </div>
  );
}

/* ── Clouds ────────────────────────────────────────────────────────────────── */
function CloudSVG({ scale = 1, color = 'white', opacity = 0.92 }: { scale?: number; color?: string; opacity?: number }) {
  return (
    <svg width={200 * scale} height={80 * scale} viewBox="0 0 200 80" style={{ display: 'block' }}>
      <g opacity={opacity}>
        <ellipse cx="100" cy="60" rx="90" ry="24" fill={color} />
        <ellipse cx="65"  cy="50" rx="38" ry="32" fill={color} />
        <ellipse cx="108" cy="46" rx="45" ry="36" fill={color} />
        <ellipse cx="148" cy="53" rx="32" ry="26" fill={color} />
        <ellipse cx="100" cy="36" rx="30" ry="22" fill={color} />
      </g>
    </svg>
  );
}

function Clouds({ type, isDay }: { type: WeatherType; isDay: boolean }) {
  const count  = type === 'sunny' ? 2 : type === 'partly_cloudy' ? 4 : 6;
  const color  = type === 'stormy' ? '#0e0e0e' : type === 'rainy' ? '#4A5568' : type === 'cloudy' ? '#9EADB6' : '#ffffff';
  const speedF = (type === 'windy' || type === 'stormy') ? 0.42 : 1;

  const clouds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    top:  4 + i * 11 + (i % 2 === 0 ? 0 : 6),
    sc:   0.55 + (i % 3) * 0.28,
    op:   isDay ? 0.75 + (i % 2) * 0.1 : 0.28,
    dur:  (38 + i * 9) * speedF,
    del:  -(i * 7 + (i % 3) * 3),
  })), [count, isDay, speedF]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>
    {clouds.map(c => (
      <div key={c.id} style={{
        position: 'absolute', top: `${c.top}%`, left: 0, zIndex: 2,
        animation: `cloudDrift ${c.dur}s linear infinite`,
        animationDelay: `${c.del}s`,
        pointerEvents: 'none',
      }}>
        <CloudSVG scale={c.sc} color={color} opacity={c.op} />
      </div>
    ))}
  </>;
}

/* ── Rain ──────────────────────────────────────────────────────────────────── */
function Rain({ heavy = false }: { heavy?: boolean }) {
  const drops = useMemo(() => Array.from({ length: heavy ? 120 : 75 }, (_, i) => ({
    id:  i,
    lft: Math.random() * 106,
    del: -(Math.random() * 1.2),
    dur: 0.45 + Math.random() * 0.35,
    h:   18 + Math.random() * 14,
    op:  0.4 + Math.random() * 0.4,
  })), [heavy]);

  return <>
    {drops.map(d => (
      <div key={d.id} style={{
        position: 'absolute', left: `${d.lft}%`, top: 0,
        width: 1.5, height: d.h, borderRadius: 2,
        background: 'linear-gradient(to bottom,rgba(174,214,241,.85),rgba(255,255,255,.5))',
        opacity: d.op, zIndex: 4, pointerEvents: 'none',
        animation: `rainDrop ${d.dur}s linear infinite`,
        animationDelay: `${d.del}s`,
        willChange: 'transform',
      }} />
    ))}
  </>;
}

/* ── Leaves ────────────────────────────────────────────────────────────────── */
const LEAF_COLS  = ['#4CAF50','#8BC34A','#FFC107','#FF9800','#FF5722','#795548','#A5D6A7','#F9A825'];
const LEAF_PATHS = [
  'M0,-9 C3,-9 9,-5 9,0 C9,5 3,9 0,9 C-3,9 -9,5 -9,0 C-9,-5 -3,-9 0,-9',
  'M0,-11 C2,-8 7,-5 7,0 C7,5 2,9 0,11 C-2,9 -7,5 -7,0 C-7,-5 -2,-8 0,-11',
  'M0,-9 C5,-9 9,-4 7,0 C9,4 5,9 0,7 C-5,9 -9,4 -7,0 C-9,-4 -5,-9 0,-9',
];

function Leaves() {
  const leaves = useMemo(() => Array.from({ length: 15 }, (_, i) => ({
    id:    i,
    topPct: 8 + Math.random() * 75,
    size:  9 + Math.random() * 11,
    color: LEAF_COLS[i % LEAF_COLS.length],
    path:  LEAF_PATHS[i % LEAF_PATHS.length],
    dur:   7 + Math.random() * 7,
    del:  -(Math.random() * 10),
  })), []);

  return <>
    {leaves.map(l => (
      <div key={l.id} style={{
        position: 'absolute', top: `${l.topPct}%`, left: 0, zIndex: 5,
        pointerEvents: 'none',
        animation: `leafFly ${l.dur}s ease-in-out infinite`,
        animationDelay: `${l.del}s`,
        willChange: 'transform',
      }}>
        <svg width={l.size * 2} height={l.size * 2} viewBox="-12 -12 24 24">
          <path d={l.path} fill={l.color} />
          <line x1="0" y1="-8" x2="0" y2="8" stroke={l.color} strokeWidth="0.8" opacity="0.5" />
        </svg>
      </div>
    ))}
  </>;
}

/* ── Lightning ─────────────────────────────────────────────────────────────── */
function Lightning() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const fire = () => {
      setOn(true);
      setTimeout(() => setOn(false), 140);
      setTimeout(fire, 2500 + Math.random() * 5500);
    };
    const t = setTimeout(fire, 1800 + Math.random() * 2500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
      background: 'white', opacity: on ? 0.14 : 0,
      transition: on ? 'none' : 'opacity 0.4s ease-out',
    }} />
  );
}

/* ── Tree ──────────────────────────────────────────────────────────────────── */
const SWAY_DEG = [2, 4, 9, 15];
const SWAY_DUR = [9, 6, 3, 1.8];

function Tree({ intensity }: { intensity: number }) {
  const sway = SWAY_DEG[intensity] ?? 2;
  const dur  = SWAY_DUR[intensity] ?? 9;
  return (
    <motion.div
      style={{
        position: 'absolute', bottom: 26, left: '4%',
        width: 220, height: 400, zIndex: 6, transformOrigin: 'bottom center',
        pointerEvents: 'none',
      }}
      animate={{ rotate: [-sway / 2, sway / 2, -sway / 2] }}
      transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg viewBox="0 0 220 400" width={220} height={400} style={{ overflow: 'visible' }}>
        {/* Roots */}
        <path d="M98,400 Q80,390 65,394"  stroke="#4E342E" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M122,400 Q140,390 155,394" stroke="#4E342E" strokeWidth="5" strokeLinecap="round" fill="none" />

        {/* Trunk */}
        <path d="M96,400 C93,355 88,300 83,255 Q94,244 110,243 Q126,244 137,255 C132,300 127,355 124,400 Z" fill="#5D4037" />
        <path d="M100,400 C99,360 97,308 96,268 Q102,258 106,258 C105,308 103,360 102,400 Z" fill="#795548" opacity="0.5" />

        {/* Branches */}
        <path d="M93,270 Q68,248 45,240"   stroke="#4E342E" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M45,240 Q28,232 12,238"   stroke="#4E342E" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M127,262 Q152,238 175,228" stroke="#4E342E" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M175,228 Q192,220 208,226" stroke="#4E342E" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M96,232 Q76,210 58,202"   stroke="#4E342E" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M124,226 Q144,204 162,196" stroke="#4E342E" strokeWidth="6" strokeLinecap="round" fill="none" />

        {/* Back depth */}
        <ellipse cx="40"  cy="228" rx="44" ry="36" fill="#1B5E20" opacity="0.88" />
        <ellipse cx="180" cy="220" rx="42" ry="34" fill="#1B5E20" opacity="0.88" />

        {/* Bottom layer */}
        <ellipse cx="110" cy="252" rx="82" ry="54" fill="#2E7D32" />
        <ellipse cx="64"  cy="238" rx="52" ry="43" fill="#33691E" opacity="0.9" />
        <ellipse cx="156" cy="232" rx="50" ry="41" fill="#2E7D32" opacity="0.9" />

        {/* Middle layer */}
        <ellipse cx="110" cy="200" rx="68" ry="54" fill="#43A047" />
        <ellipse cx="76"  cy="190" rx="48" ry="40" fill="#388E3C" opacity="0.95" />
        <ellipse cx="144" cy="185" rx="46" ry="38" fill="#2E7D32" opacity="0.9" />

        {/* Upper-middle */}
        <ellipse cx="110" cy="152" rx="56" ry="48" fill="#4CAF50" />
        <ellipse cx="84"  cy="142" rx="40" ry="35" fill="#66BB6A" />
        <ellipse cx="136" cy="138" rx="38" ry="33" fill="#43A047" opacity="0.9" />

        {/* Crown */}
        <ellipse cx="110" cy="106" rx="42" ry="40" fill="#81C784" />
        <ellipse cx="96"  cy="90"  rx="28" ry="26" fill="#A5D6A7" />
        <ellipse cx="124" cy="88"  rx="26" ry="24" fill="#66BB6A" opacity="0.9" />

        {/* Tip */}
        <ellipse cx="110" cy="64" rx="18" ry="18" fill="#C8E6C9" />

        {/* Highlights */}
        <ellipse cx="88"  cy="82"  rx="12" ry="10" fill="white" opacity="0.07" />
        <ellipse cx="72"  cy="178" rx="10" ry="8"  fill="white" opacity="0.06" />
        <ellipse cx="90"  cy="238" rx="14" ry="10" fill="white" opacity="0.05" />
      </svg>
    </motion.div>
  );
}

/* ── Weather Badge ─────────────────────────────────────────────────────────── */
const W_EMOJI: Record<WeatherType, string> = {
  sunny: '☀️', partly_cloudy: '⛅', cloudy: '☁️', windy: '🌬️', rainy: '🌧️', stormy: '⛈️',
};
const W_LABEL: Record<WeatherType, string> = {
  sunny: 'Sunny', partly_cloudy: 'Partly Cloudy', cloudy: 'Overcast',
  windy: 'Windy', rainy: 'Rainy', stormy: 'Thunderstorm',
};

function WeatherBadge({ w }: { w: WeatherState | null }) {
  if (!w) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      style={{
        position: 'absolute', bottom: 18, right: 18, zIndex: 20,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
        borderRadius: 14, padding: '9px 14px',
        border: '1px solid rgba(255,255,255,0.14)',
        display: 'flex', alignItems: 'center', gap: 10,
        pointerEvents: 'none',
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{W_EMOJI[w.type]}</span>
      <div>
        <div style={{ color: 'white', fontSize: 15, fontWeight: 700, lineHeight: 1 }}>
          {w.temp !== null ? `${w.temp}°C` : W_LABEL[w.type]}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 3 }}>
          {w.city ? `${w.city} · ` : ''}{W_LABEL[w.type]}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────────── */
const INTENSITY_MAP: Record<WeatherType, number> = {
  stormy: 3, windy: 3, rainy: 1, cloudy: 1, partly_cloudy: 0, sunny: 0,
};

export default function WeatherBackground() {
  const [weather, setWeather] = useState<WeatherState | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 6000);
        const loc  = await fetch('https://ipapi.co/json/', { signal: ctrl.signal }).then(r => r.json());
        clearTimeout(to);
        const { latitude, longitude, city } = loc;
        const { current_weather: cw } = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&wind_speed_unit=kmh`
        ).then(r => r.json());
        setWeather({
          type:      wmoToType(cw.weathercode, cw.windspeed),
          isDay:     cw.is_day === 1,
          temp:      Math.round(cw.temperature),
          city:      city || '',
          windSpeed: cw.windspeed,
        });
      } catch {
        setWeather({ type: 'partly_cloudy', isDay: true, temp: null, city: '', windSpeed: 12 });
      }
    })();
  }, []);

  const type      = weather?.type ?? 'partly_cloudy';
  const isDay     = weather?.isDay ?? true;
  const intensity = INTENSITY_MAP[type] ?? 0;

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: skyGrad(type, isDay),
      transition: 'background 2s ease',
    }}>
      <style>{CSS_ANIM}</style>

      <Stars   visible={!isDay} />
      <Moon    visible={!isDay} />
      <Sun     show={isDay && (type === 'sunny' || type === 'partly_cloudy')} />
      <Clouds  type={type} isDay={isDay} />

      {(type === 'rainy' || type === 'stormy') && <Rain heavy={type === 'stormy'} />}
      {type === 'windy'  && <Leaves />}
      {type === 'stormy' && <Lightning />}

      <Tree intensity={intensity} />

      {/* Grass strip */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 55, zIndex: 5,
        background: `linear-gradient(to top,${isDay ? '#1A4C1A' : '#0D260D'},${isDay ? '#2E7D32' : '#162E16'},transparent)`,
        pointerEvents: 'none',
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 7, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,0.2) 100%)',
      }} />

      <WeatherBadge w={weather} />
    </div>
  );
}
