import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';

const faqs = [
  {
    q: 'What is ArcSend?',
    a: 'ArcSend is a chain-abstracted USDC transfer app that treats Ethereum, Base, Polygon, and Solana as one liquidity surface through a single experience.'
  },
  {
    q: 'How does ArcSend stay chain-abstracted?',
    a: 'ArcSend routes transfer intents through one backend orchestration layer, so users do not need to manage separate cross-chain tools for each destination network.'
  },
  {
    q: 'Which Circle tools are used?',
    a: 'The app uses Circle Wallets APIs for wallet operations and an Arc + CCTPv2 adapter path for cross-chain USDC movement and settlement.'
  },
  {
    q: 'What are the main product components?',
    a: 'ArcSend includes a React frontend, a Node.js/Express backend with JWT auth, PostgreSQL persistence, and a CLI tool for login, balance checks, sends, and history.'
  },
  {
    q: 'Can I test locally without live Circle credentials?',
    a: 'Yes. The backend supports a MOCK_CIRCLE mode for local MVP demos while preserving the same user flow and API shape used for production integration.'
  },
  {
    q: 'How do I start using the service?',
    a: 'From the landing page, click Launch App, create an account or login, initialize wallets by chain, then send USDC and monitor status in transaction history.'
  }
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="section-light py-24">
      <div className="container mx-auto max-w-3xl px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display mb-12 text-center text-3xl font-bold text-section-light-foreground md:text-4xl"
        >
          Frequently Asked Questions
        </motion.h2>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <motion.div
              key={faq.q}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="overflow-hidden rounded-xl border border-section-light-foreground/10 bg-white"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-section-light-foreground/5"
              >
                <span className="text-sm font-medium text-section-light-foreground/70">{faq.q}</span>
                {openIndex === index ? (
                  <Minus className="h-4 w-4 shrink-0 text-section-light-foreground/40" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-section-light-foreground/40" />
                )}
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm leading-relaxed text-section-light-foreground/50">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
