export { ArcSendClient, type ArcSendConfig } from './client';
export * from './types';
export * from './status';
export { ArcEventEmitter, ARC_EVENTS, type ArcEventName, type ArcEventPayloads } from './events';
export { ExecutionTracker, type TrackedTransfer } from './execution-tracker';

export { AuthModule } from './modules/auth';
export { WalletsModule } from './modules/wallets';
export { TransfersModule } from './modules/transfers';
export { TransactionsModule } from './modules/transactions';

import { ArcSendClient } from './client';
export default ArcSendClient;
