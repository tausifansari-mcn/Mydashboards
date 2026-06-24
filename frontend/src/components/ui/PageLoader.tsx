import { motion } from 'framer-motion';

export default function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFC]">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary"
      />
    </div>
  );
}
