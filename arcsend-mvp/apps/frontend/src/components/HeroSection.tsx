import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

const particles = Array.from({ length: 30 }, (_, index) => ({
  id: index,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  delay: Math.random() * 4
}));

export default function HeroSection({ onLaunchApp }: { onLaunchApp: () => void }) {
  return (
    <section className="hero-bg relative flex min-h-screen items-center justify-center overflow-hidden pt-20 text-white">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-cyan-300/20"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size
          }}
          animate={{ opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: 4, delay: particle.delay, repeat: Infinity }}
        />
      ))}

      <div className="container relative z-10 mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mx-auto mb-8 w-full max-w-sm"
        >
          <div className="card-glow rounded-2xl border border-slate-600 bg-slate-900/75 p-5 backdrop-blur-md">
            <p className="mb-3 text-left text-xs text-slate-400">From</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-700" />
                <div className="text-left">
                  <p className="text-sm text-slate-100">Token</p>
                  <p className="text-xs text-slate-400">Select Chain</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Amount</p>
                <p className="text-lg text-slate-100">0.0</p>
              </div>
            </div>
            <div className="my-3 flex justify-center">
              <ArrowDown className="h-5 w-5 text-slate-400" />
            </div>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="font-display text-5xl font-bold leading-tight text-white md:text-7xl"
        >
          ArcSend
          <br />
          Chain-Abstracted USDC
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <p className="text-lg text-slate-300">
            One liquidity surface across Ethereum, Base, Polygon, and Solana.
          </p>
          <button
            onClick={onLaunchApp}
            className="rounded-full border border-slate-400 px-8 py-2.5 text-sm font-medium text-white transition-all hover:border-cyan-300 hover:text-cyan-200"
          >
            Launch App
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          {[
            { value: '4', label: 'Supported Chains' },
            { value: 'USDC', label: 'Settlement Asset' },
            { value: 'Web + API + CLI', label: 'Product Surfaces' },
            { value: 'Arc + CCTPv2', label: 'Cross-Chain Stack' }
          ].map((stat) => (
            <div key={stat.label} className="bg-stat rounded-xl border border-slate-600/50 p-6">
              <p className="font-display text-xl font-bold text-white md:text-2xl">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-300">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
