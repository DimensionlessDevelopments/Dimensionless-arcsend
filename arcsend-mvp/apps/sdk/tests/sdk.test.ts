import axios from 'axios';
import { ArcSendClient } from '../src';

jest.mock('axios');

describe('ArcSend SDK', () => {
  const mockGet = jest.fn();
  const mockPost = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue({
      get: mockGet,
      post: mockPost,
      defaults: { headers: { common: {} } }
    });
  });

  test('estimates transfer via /transfer/quote', async () => {
    const client = new ArcSendClient({ token: 'jwt-token', baseUrl: 'http://localhost:4001' });

    mockPost.mockResolvedValueOnce({
      data: {
        route: {
          provider: 'CircleArc',
          routeId: 'arc_123',
          fromChain: 'base',
          toChain: 'ethereum',
          amount: '10.00',
          estimatedFeeUsdc: '0.010000',
          estimatedReceiveUsdc: '9.990000',
          settlementPath: 'Arc -> CCTPv2',
          estimatedEtaSeconds: 90
        }
      }
    });

    const result = await client.transfers.estimate({
      destinationChain: 'Ethereum_Sepolia',
      amount: '10.00'
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/transfer/quote',
      { toChain: 'ethereum', amount: '10.00' },
      expect.any(Object)
    );
    expect(result.success).toBe(true);
    expect(result.data?.route.toChain).toBe('ethereum');
  });

  test('sends transfer via /transfer/send', async () => {
    const client = new ArcSendClient({ token: 'jwt-token', baseUrl: 'http://localhost:4001' });

    mockPost.mockResolvedValueOnce({
      data: {
        id: 'tx_1',
        userId: 'user_1',
        fromChain: 'base',
        toChain: 'ethereum',
        amount: '10.00',
        recipient: '0x742d35Cc6634C0532925a3b844Bc0d3f5b9b7b3c',
        status: 'submitted',
        bridgeType: 'CircleArc+CCTPv2',
        txHash: '0xhash',
        createdAt: new Date().toISOString(),
        route: {
          provider: 'CircleArc',
          routeId: 'arc_123',
          fromChain: 'base',
          toChain: 'ethereum',
          amount: '10.00',
          estimatedFeeUsdc: '0.010000',
          estimatedReceiveUsdc: '9.990000',
          settlementPath: 'Arc -> CCTPv2',
          estimatedEtaSeconds: 90
        }
      }
    });

    const result = await client.transfers.send({
      destinationAddress: '0x742d35Cc6634C0532925a3b844Bc0d3f5b9b7b3c',
      destinationChain: 'Ethereum_Sepolia',
      amount: '10.00'
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/transfer/send',
      expect.objectContaining({
        toChain: 'ethereum',
        amount: '10.00'
      }),
      expect.any(Object)
    );
    expect(result.data?.status).toBe('submitted');
  });

  test('loads transaction list', async () => {
    const client = new ArcSendClient({ token: 'jwt-token', baseUrl: 'http://localhost:4001' });

    mockGet.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'tx_1',
            userId: 'user_1',
            fromChain: 'base',
            toChain: 'ethereum',
            amount: '10.00',
            recipient: '0x742d35Cc6634C0532925a3b844Bc0d3f5b9b7b3c',
            status: 'completed',
            bridgeType: 'CircleArc+CCTPv2',
            txHash: '0xhash',
            createdAt: new Date().toISOString()
          }
        ]
      }
    });

    const result = await client.transactions.list();
    expect(mockGet).toHaveBeenCalledWith('/transactions', expect.any(Object));
    expect(result.data?.length).toBe(1);
  });

  test('normalizes transfer status to canonical lifecycle', async () => {
    const client = new ArcSendClient({ token: 'jwt-token', baseUrl: 'http://localhost:4001' });

    mockGet.mockResolvedValueOnce({
      data: {
        id: 'tx_2',
        status: 'submitted',
        txHash: '0xabc',
        fromChain: 'base',
        toChain: 'ethereum',
        amount: '10.00',
        recipient: '0x742d35Cc6634C0532925a3b844Bc0d3f5b9b7b3c',
        updatedAt: new Date().toISOString()
      }
    });

    const status = await client.transfers.getStatusNormalized('tx_2');
    expect(status.data?.rawStatus).toBe('submitted');
    expect(status.data?.status).toBe('pending');
  });
});
