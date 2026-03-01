#!/usr/bin/env node
import { Command } from 'commander';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

const API_BASE = process.env.ARCSEND_API || 'http://localhost:4000';
const STORE_PATH = path.join(os.homedir(), '.arcsend.json');

function saveToken(token) {
  fs.writeFileSync(STORE_PATH, JSON.stringify({ token }, null, 2));
}

function getToken() {
  if (!fs.existsSync(STORE_PATH)) return '';
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    return parsed.token || '';
  } catch {
    return '';
  }
}

function api(token) {
  return axios.create({
    baseURL: API_BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

function clearToken() {
  if (!fs.existsSync(STORE_PATH)) {
    return;
  }

  fs.unlinkSync(STORE_PATH);
}

function normalizeTransferPhase(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'submitted') {
    return 'routing';
  }

  if (normalized === 'confirmed') {
    return 'settling';
  }

  if (normalized === 'completed') {
    return 'completed';
  }

  if (normalized === 'failed') {
    return 'failed';
  }

  return normalized || 'unknown';
}

function toTableRows(items) {
  return items.map((item) => ({
    id: item.id,
    phase: normalizeTransferPhase(item.status),
    status: item.status,
    fromChain: item.fromChain,
    toChain: item.toChain,
    amount: item.amount,
    recipient: item.recipient,
    txHash: item.txHash,
    updatedAt: item.updatedAt || item.createdAt
  }));
}

function printApiError(error) {
  const payload = error.response?.data;
  if (payload) {
    console.error(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
    return;
  }

  console.error(error.message);
}

function requireTokenOrExit() {
  const token = getToken();
  if (!token) {
    throw new Error('Please login first with: arcsend login --email <email> --password <password>');
  }

  return token;
}

const program = new Command();
program.name('arcsend').description('ArcSend cross-chain USDC CLI').version('1.0.0');

program
  .command('login')
  .requiredOption('--email <email>')
  .requiredOption('--password <password>')
  .action(async (options) => {
    try {
      const response = await api().post('/auth/login', {
        email: options.email,
        password: options.password
      });
      saveToken(response.data.token);
      console.log('Login successful. Token stored.');
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program.command('logout').description('Remove stored auth token').action(() => {
  clearToken();
  console.log('Logged out. Token removed.');
});

program
  .command('chains')
  .description('List ArcSend supported chains')
  .option('--json', 'output raw JSON', false)
  .action(async (options) => {
    try {
      const response = await api().get('/wallet/chains');
      const chains = response.data.chains || [];

      if (options.json) {
        console.log(JSON.stringify(chains, null, 2));
        return;
      }

      console.table(chains);
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program
  .command('liquidity')
  .description('Show unified crosschain USDC liquidity surface')
  .option('--json', 'output raw JSON', false)
  .action(async (options) => {
    try {
      const token = requireTokenOrExit();
      const response = await api(token).get('/wallet/liquidity');

      if (options.json) {
        console.log(JSON.stringify(response.data, null, 2));
        return;
      }

      console.table(response.data.chains || []);
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program
  .command('balance')
  .description('Get wallet balance by chain')
  .option('--chain <chain>', 'Chain name', 'base')
  .option('--json', 'output raw JSON', false)
  .action(async (options) => {
    try {
      const token = requireTokenOrExit();
      const response = await api(token).get(`/wallet/balance?chain=${options.chain}`);

      if (options.json) {
        console.log(JSON.stringify(response.data, null, 2));
        return;
      }

      console.table([response.data]);
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program
  .command('wallets')
  .description('List user wallets across chains')
  .option('--include-balance', 'include wallet balances', false)
  .option('--json', 'output raw JSON', false)
  .action(async (options) => {
    try {
      const token = requireTokenOrExit();
      const response = await api(token).get('/wallet/list', {
        params: { includeBalance: options.includeBalance }
      });

      const items = response.data.items || [];
      if (options.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      console.table(
        items.map((item) => ({
          id: item.id,
          chain: item.chain,
          label: item.label,
          chainCode: item.chainCode,
          isRoutable: item.isRoutable
        }))
      );
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program
  .command('wallet-create')
  .description('Create wallet for a chain if missing')
  .requiredOption('--chain <chain>')
  .option('--json', 'output raw JSON', false)
  .action(async (options) => {
    try {
      const token = requireTokenOrExit();
      const response = await api(token).post('/wallet/create', { chain: options.chain });

      if (options.json) {
        console.log(JSON.stringify(response.data, null, 2));
        return;
      }

      console.table([response.data]);
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program
  .command('quote')
  .description('Quote ArcSend route for crosschain USDC transfer')
  .requiredOption('--to <chain>')
  .requiredOption('--amount <amount>')
  .option('--from <chain>')
  .option('--json', 'output raw JSON instead of table', false)
  .action(async (options) => {
    try {
      const token = requireTokenOrExit();

      const response = await api(token).post('/transfer/quote', {
        fromChain: options.from,
        toChain: options.to,
        amount: options.amount
      });

      if (options.json) {
        console.log(JSON.stringify(response.data.route, null, 2));
        return;
      }

      console.log('Arc route quote:');
      console.table(response.data.route);
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program
  .command('pay')
  .alias('send')
  .description('Execute a crosschain USDC payment intent (backend selects route by default)')
  .requiredOption('--to <chain>')
  .requiredOption('--amount <amount>')
  .requiredOption('--recipient <address>')
  .option('--from <chain>')
  .option('--strategy <strategy>', 'auto or manual source route selection', 'auto')
  .option('--json', 'output raw JSON instead of object log', false)
  .action(async (options) => {
    try {
      const token = requireTokenOrExit();
      const response = await api(token).post('/transfer/send', {
        fromChain: options.from,
        toChain: options.to,
        amount: options.amount,
        recipient: options.recipient,
        routeStrategy: options.strategy
      });

      if (options.json) {
        console.log(JSON.stringify(response.data, null, 2));
        return;
      }

      const transfer = response.data;
      console.table(
        toTableRows([
          {
            ...transfer,
            updatedAt: transfer.createdAt
          }
        ])
      );
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Get transfer status by transfer ID or tx hash')
  .argument('<id>', 'transfer ID or tx hash')
  .option('--json', 'output raw JSON', false)
  .action(async (id, options) => {
    try {
      const token = requireTokenOrExit();
      const response = await api(token).get(`/transfer/status/${id}`);

      if (options.json) {
        console.log(JSON.stringify(response.data, null, 2));
        return;
      }

      console.table(toTableRows([response.data]));
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('List transfer history with normalized ArcSend phases')
  .option('--json', 'output raw JSON instead of table', false)
  .action(async (options) => {
    try {
      const token = requireTokenOrExit();
      const response = await api(token).get('/transfer/history');
      const items = response.data.items || [];

      if (options.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      console.table(toTableRows(items));
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program
  .command('treasury-plan')
  .description('Build treasury rebalance plan for target chain USDC minimum')
  .requiredOption('--target-chain <chain>')
  .requiredOption('--min-usdc <amount>')
  .option('--json', 'output raw JSON', false)
  .action(async (options) => {
    try {
      const token = requireTokenOrExit();
      const response = await api(token).post('/treasury/rebalance/plan', {
        targetChain: options.targetChain,
        minUsdc: options.minUsdc
      });

      if (options.json) {
        console.log(JSON.stringify(response.data.plan, null, 2));
        return;
      }

      console.table([response.data.plan]);
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program
  .command('treasury-execute')
  .description('Execute treasury rebalance via ArcSend routing')
  .requiredOption('--target-chain <chain>')
  .requiredOption('--min-usdc <amount>')
  .option('--json', 'output raw JSON', false)
  .action(async (options) => {
    try {
      const token = requireTokenOrExit();
      const response = await api(token).post('/treasury/rebalance/execute', {
        targetChain: options.targetChain,
        minUsdc: options.minUsdc
      });

      if (options.json) {
        console.log(JSON.stringify(response.data, null, 2));
        return;
      }

      const tx = response.data.tx;
      console.table(
        toTableRows([
          {
            ...tx,
            updatedAt: tx.createdAt
          }
        ])
      );
    } catch (error) {
      printApiError(error);
      process.exit(1);
    }
  });

program.parse(process.argv);
