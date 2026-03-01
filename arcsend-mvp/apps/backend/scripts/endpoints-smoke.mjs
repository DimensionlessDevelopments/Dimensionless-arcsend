import axios from 'axios';
import { Wallet } from 'ethers';

const api = process.env.API_URL || 'http://localhost:4001';

const wallet = Wallet.createRandom();
const challenge = (
  await axios.post(`${api}/auth/wallet/challenge`, {
    address: wallet.address
  })
).data;

const signature = await wallet.signMessage(challenge.message);
const verify = (
  await axios.post(`${api}/auth/wallet/verify`, {
    address: wallet.address,
    message: challenge.message,
    signature
  })
).data;

const authed = axios.create({
  baseURL: api,
  headers: {
    Authorization: `Bearer ${verify.token}`
  },
  validateStatus: () => true
});

const walletList = await authed.get('/wallet/list');
const txList = await authed.get('/transactions');
const txStatusMissing = await authed.get('/transfer/status/not-found-id');
const txGetMissing = await authed.get('/transactions/not-found-id');

const webhook = await axios.post(
  `${api}/transactions/webhooks`,
  {
    data: {
      transaction: {
        id: 'external-demo-id',
        state: 'CONFIRMED'
      }
    }
  },
  { validateStatus: () => true }
);

console.log(
  JSON.stringify(
    {
      walletListStatus: walletList.status,
      txListStatus: txList.status,
      txStatusMissing: txStatusMissing.status,
      txGetMissing: txGetMissing.status,
      webhookStatus: webhook.status
    },
    null,
    2
  )
);
