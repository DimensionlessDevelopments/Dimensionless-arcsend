import { motion } from 'framer-motion';

const chains = [
  'ETH',
  'BASE',
  'MATIC',
  'SOL'
];

const chainColors = [
  'hsl(220 70% 55%)', '#1652F0', 'hsl(260 70% 55%)', '#03E1FF',
  'hsl(210 80% 55%)', 'hsl(0 80% 50%)', 'hsl(220 60% 50%)', 'hsl(140 60% 50%)',
  'hsl(0 80% 45%)', 'hsl(120 60% 50%)', 'hsl(280 60% 55%)', 'hsl(220 80% 55%)',
  'hsl(45 80% 50%)', 'hsl(30 80% 55%)', 'hsl(250 60% 55%)', 'hsl(200 80% 50%)',
  'hsl(340 70% 50%)', 'hsl(200 90% 55%)', 'hsl(160 50% 45%)', 'hsl(200 70% 50%)',
  'hsl(260 80% 60%)', 'hsl(0 0% 30%)', 'hsl(0 0% 50%)', 'hsl(330 80% 55%)',
  'hsl(210 70% 50%)', 'hsl(194, 72%, 46%)'
];

export default function ChainsSection() {
  return (
    <section className="section-light py-24">
      <div className="container mx-auto px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-3xl font-bold text-section-light-foreground md:text-4xl"
        >
          ArcSend Supported Liquidity Surface
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-4 max-w-2xl text-section-light-foreground/60"
        >
          ArcSend abstracts cross-chain USDC transfers across Ethereum, Base, Polygon, and Solana so users can operate from one unified interface.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-4"
        >
          {chains.map((chain, index) => (
            <motion.div
              key={chain}
              whileHover={{ scale: 1.15 }}
              className="flex h-12 w-12 items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: chainColors[index % chainColors.length],
                color: 'white'
              }}
            >
              {chain}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
