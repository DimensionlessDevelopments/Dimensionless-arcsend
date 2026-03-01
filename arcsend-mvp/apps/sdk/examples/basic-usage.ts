import ArcSendClient from 'arcsend-sdk';

const arcsend = new ArcSendClient({
  baseUrl: 'http://localhost:4001'
});

async function main() {
  const login = await arcsend.auth.login('demo@example.com', 'password123');
  if (!login.data) {
    throw new Error(login.error || 'Login failed');
  }

  arcsend.setToken(login.data.token);

  const balance = await arcsend.wallets.getBalance('arc-testnet');
  console.log('Balance:', balance.data?.balance, balance.data?.token);

  const estimate = await arcsend.transfers.estimate({
    destinationChain: 'ethereum',
    amount: '10.00',
    routeStrategy: 'auto'
  });
  console.log('Estimated route:', estimate.data?.route);

  const transfer = await arcsend.transfers.send({
    destinationAddress: '0x742d35Cc6634C0532925a3b844Bc0d3f5b9b7b3c',
    destinationChain: 'ethereum',
    amount: '10.00',
    routeStrategy: 'auto'
  });

  console.log('Transfer initiated:', transfer.data?.id);

  if (transfer.data?.id) {
    const status = await arcsend.transfers.getStatus(transfer.data.id);
    console.log('Status:', status.data?.status);
  }
}

void main();
