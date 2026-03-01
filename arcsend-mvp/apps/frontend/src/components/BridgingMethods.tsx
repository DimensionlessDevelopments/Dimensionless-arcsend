import { motion } from 'framer-motion';
import { RefreshCw, Shield, Zap } from 'lucide-react';

const methods = [
  {
    icon: Shield,
    title: 'Unified Backend Orchestration',
    description:
      'ArcSend routes transfer intents through one Node.js/Express backend so users interact with a single app while settlement spans multiple chains.'
  },
  {
    icon: Zap,
    title: 'Circle Wallets + Arc Path',
    description:
      'Wallet management and transfer execution are integrated through Circle Wallets and an Arc + CCTPv2 adapter path for cross-chain USDC movement.'
  },
  {
    icon: RefreshCw,
    title: 'Multi-Surface Product Experience',
    description:
      'The same system is accessible via React frontend, backend APIs, and the ArcSend CLI for login, balances, transfers, and history.'
  }
];

export default function BridgingMethods() {
  return (
    <section className="bg-background py-24">
      <div className="container mx-auto px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-3xl font-bold text-foreground md:text-4xl"
        >
          ArcSend Core Methods
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-4 max-w-2xl text-muted-foreground"
        >
          ArcSend treats Ethereum, Base, Polygon, and Solana as one liquidity surface with a single application flow.
        </motion.p>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {methods.map((method, index) => (
            <motion.div
              key={method.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="group rounded-2xl border border-border/50 bg-card p-8 text-center transition-all hover:card-glow"
            >
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-border/50 bg-secondary/50 transition-colors group-hover:border-primary/30">
                <method.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-display mt-6 text-xl font-semibold text-foreground">{method.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{method.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
