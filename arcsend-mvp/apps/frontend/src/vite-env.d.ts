/// <reference types="vite/client" />

interface EthereumProvider {
	isMetaMask?: boolean;
	request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
}

interface Window {
	ethereum?: EthereumProvider;
}
