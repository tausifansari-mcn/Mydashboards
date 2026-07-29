import { motion } from 'framer-motion';
import { ShieldCheck, PhoneIncoming, PhoneOutgoing, TrendingUp, Sparkles } from 'lucide-react';

const FEATURES: { icon: typeof ShieldCheck; label: string; desc: string; accent: string; bg: string }[] = [
  { icon: ShieldCheck,    label: 'AI Quality Audit',    desc: 'AI-scored call quality, fatal analysis & audit trails', accent: '#60A5FA', bg: 'rgba(96,165,250,0.14)' },
  { icon: PhoneIncoming,  label: 'Inbound Analytics',   desc: 'Live SL%, AL%, ACHT and agent performance',             accent: '#34D399', bg: 'rgba(52,211,153,0.14)' },
  { icon: PhoneOutgoing,  label: 'Outbound Analytics',  desc: 'Magical Script funnels & conversion tracking',          accent: '#FBBF24', bg: 'rgba(251,191,36,0.14)' },
  { icon: TrendingUp,     label: 'Sales Dashboard',     desc: 'Revenue, funnel and brand-wise performance',            accent: '#F472B6', bg: 'rgba(244,114,182,0.14)' },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function LoginShowcase() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="relative z-10 flex h-full w-full flex-col justify-center px-12 py-16 xl:px-20"
    >
      <motion.div variants={itemVariants} className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-sm">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/80">Live Analytics Platform</span>
      </motion.div>

      <motion.h1 variants={itemVariants} className="max-w-md text-4xl font-extrabold leading-tight text-white xl:text-[2.75rem]">
        One Portal.{' '}
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(90deg, #60A5FA, #A78BFA, #60A5FA)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 6s linear infinite',
          }}
        >
          Every Call
        </span>{' '}
        Insight.
      </motion.h1>

      <motion.p variants={itemVariants} className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
        Mas CallNet Analytics unifies AI quality audits, inbound &amp; outbound performance,
        and sales reporting into a single, real-time dashboard.
      </motion.p>

      <div className="mt-10 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.label}
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="group rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md transition-colors hover:border-white/20 hover:bg-white/[0.09]"
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 1.5 }}
                className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: f.bg }}
              >
                <Icon size={17} style={{ color: f.accent }} />
              </motion.div>
              <p className="text-[13px] font-bold text-white">{f.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/50">{f.desc}</p>
            </motion.div>
          );
        })}
      </div>

      <motion.div variants={itemVariants} className="mt-10 flex items-center gap-2 text-white/40">
        <Sparkles size={13} />
        <span className="text-[11px] font-medium">Powered by AI-driven call intelligence</span>
      </motion.div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </motion.div>
  );
}
