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

console.log(
  JSON.stringify(
    {
      ok: Boolean(verify.token),
      address: wallet.address,
      tokenLength: verify.token?.length ?? 0,
      user: verify.user
    },
    null,
    2
  )
);
