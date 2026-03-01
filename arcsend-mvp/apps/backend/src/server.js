import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { requireAuth } from './middlewares/auth.js';
import { login, signup, walletChallenge, walletVerify } from './controllers/authController.js';
import {
  createWallet,
  getBalance,
  getLiquidity,
  getMetadata,
  listWallets,
  supportedChains
} from './controllers/walletController.js';
import { rebalanceExecute, rebalancePlan } from './controllers/treasuryController.js';
import {
  getTransaction,
  history,
  listTransactions,
  quoteTransfer,
  sendTransfer,
  transactionWebhook,
  transferStatus
} from './controllers/transferController.js';
import { approvePayoutRun, executePayoutRun, payoutPreview } from './controllers/payoutController.js';
import {
  createPayoutPolicy,
  listPayoutPolicies,
  updatePayoutPolicy
} from './controllers/payoutPolicyController.js';
import { schedulerRun } from './controllers/schedulerController.js';
import { startSchedulerWorker } from './treasury/schedulerWorker.js';
import {
  getPayoutRun,
  listDueRetryItems,
  listPayoutRuns
} from './controllers/treasuryObservabilityController.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    service: 'arcsend-backend',
    status: 'ok',
    message: 'Backend is running. Use the frontend at http://localhost:5173'
  });
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
  res.status(204).end();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'arcsend-backend' });
});

app.post('/auth/signup', signup);
app.post('/auth/login', login);
app.post('/auth/wallet/challenge', walletChallenge);
app.post('/auth/wallet/verify', walletVerify);

app.get('/wallet/chains', supportedChains);
app.post('/wallet/create', requireAuth, createWallet);
app.get('/wallet/list', requireAuth, listWallets);
app.get('/wallet/balance', requireAuth, getBalance);
app.get('/wallet/liquidity', requireAuth, getLiquidity);
app.get('/wallet/metadata', requireAuth, getMetadata);

app.post('/transfer/send', requireAuth, sendTransfer);
app.post('/transfer/quote', requireAuth, quoteTransfer);
app.get('/transfer/history', requireAuth, history);
app.get('/transfer/status/:id', requireAuth, transferStatus);

app.get('/transactions', requireAuth, listTransactions);
app.get('/transactions/:id', requireAuth, getTransaction);
app.post('/transactions/webhooks', transactionWebhook);

app.post('/treasury/rebalance/plan', requireAuth, rebalancePlan);
app.post('/treasury/rebalance/execute', requireAuth, rebalanceExecute);
app.post('/treasury/payouts/preview', requireAuth, payoutPreview);
app.post('/treasury/payouts/:runId/approve', requireAuth, approvePayoutRun);
app.post('/treasury/payouts/:runId/execute', requireAuth, executePayoutRun);
app.post('/treasury/policies', requireAuth, createPayoutPolicy);
app.get('/treasury/policies', requireAuth, listPayoutPolicies);
app.patch('/treasury/policies/:policyId', requireAuth, updatePayoutPolicy);
app.post('/treasury/scheduler/run', requireAuth, schedulerRun);
app.get('/treasury/runs', requireAuth, listPayoutRuns);
app.get('/treasury/runs/:runId', requireAuth, getPayoutRun);
app.get('/treasury/items/due-retries', requireAuth, listDueRetryItems);

app.listen(config.port, () => {
  console.log(`ArcSend backend running on http://localhost:${config.port}`);
  startSchedulerWorker();
});
