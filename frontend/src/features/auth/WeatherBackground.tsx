export default function WeatherBackground() {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: 'linear-gradient(135deg, #0B1437 0%, #0F2167 35%, #1740A6 65%, #1D4ED8 100%)',
    }}>
      {/* Animated orbs */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-10%',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,179,237,0.18) 0%, transparent 70%)',
        animation: 'orbFloat1 14s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-5%',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
        animation: 'orbFloat2 18s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '30%', right: '20%',
        width: 350, height: 350, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)',
        animation: 'orbFloat3 11s ease-in-out infinite',
      }} />

      {/* Dot grid pattern */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      {/* Diagonal shine */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%)',
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)',
      }} />

      <style>{`
        @keyframes orbFloat1 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(40px,60px) scale(1.08); }
          66%      { transform: translate(-30px,30px) scale(0.95); }
        }
        @keyframes orbFloat2 {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(-50px,-40px) scale(1.06); }
          75%      { transform: translate(30px,-60px) scale(0.97); }
        }
        @keyframes orbFloat3 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(20px,-35px) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
