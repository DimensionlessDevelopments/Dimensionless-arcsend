import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
  type TokenBlockchain,
} from "@circle-fin/developer-controlled-wallets";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const ENV_PATH = path.join(__dirname, "..", ".env");
const WALLET_SET_NAME = "ArcSend Wallet Onboarding";
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

function normalizeApiKey(rawApiKey: string) {
  return rawApiKey.trim().replace(/^['\"]|['\"]$/g, "");
}

function assertApiKeyFormat(apiKey: string) {
  const segments = apiKey.split(":");
  if (segments.length !== 3) {
    throw new Error(
      "Invalid CIRCLE_API_KEY format in apps/backend/.env. Expected TEST_API_KEY:<key_id>:<key_secret>.",
    );
  }

  const [environment, keyId, keySecret] = segments;
  if (environment !== "TEST_API_KEY") {
    throw new Error(
      "This project is testnet-only. CIRCLE_API_KEY must start with TEST_API_KEY.",
    );
  }

  if (!keyId || !keySecret) {
    throw new Error(
      "Invalid CIRCLE_API_KEY. Key ID and key secret segments must both be non-empty.",
    );
  }
}

function upsertEnvValue(filePath: string, key: string, value: string) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf-8");
  }

  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, "m");

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    if (content.length > 0 && !content.endsWith("\n")) {
      content += "\n";
    }
    content += `${line}\n`;
  }

  fs.writeFileSync(filePath, content, "utf-8");
}

async function main() {
  const rawApiKey = process.env.CIRCLE_API_KEY;
  if (!rawApiKey) {
    throw new Error(
      "CIRCLE_API_KEY is required. Add it to apps/backend/.env or set it as an environment variable.",
    );
  }
  const apiKey = normalizeApiKey(rawApiKey);
  assertApiKeyFormat(apiKey);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Registering Entity Secret...");
  const entitySecret = crypto.randomBytes(32).toString("hex");
  await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: OUTPUT_DIR,
  });
  upsertEnvValue(ENV_PATH, "CIRCLE_ENTITY_SECRET", entitySecret);
  console.log("Entity Secret registered.");

  console.log("\nCreating Wallet Set...");
  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  const walletSet = (await client.createWalletSet({ name: WALLET_SET_NAME })).data
    ?.walletSet;
  if (!walletSet?.id) {
    throw new Error("Wallet Set creation failed: no ID returned");
  }

  console.log("Wallet Set ID:", walletSet.id);
  upsertEnvValue(ENV_PATH, "CIRCLE_WALLET_SET_ID", walletSet.id);

  console.log("\nCreating Wallet on ARC-TESTNET...");
  const wallet = (
    await client.createWallets({
      walletSetId: walletSet.id,
      blockchains: ["ARC-TESTNET"],
      count: 1,
      accountType: "EOA",
    })
  ).data?.wallets?.[0];

  if (!wallet) {
    throw new Error("Wallet creation failed: no wallet returned");
  }

  console.log("Wallet ID:", wallet.id);
  console.log("Address:", wallet.address);
  upsertEnvValue(ENV_PATH, "CIRCLE_WALLET_ID", wallet.id);
  upsertEnvValue(ENV_PATH, "CIRCLE_WALLET_ADDRESS", wallet.address);
  upsertEnvValue(ENV_PATH, "CIRCLE_WALLET_BLOCKCHAIN", wallet.blockchain);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "wallet-info.json"),
    JSON.stringify(wallet, null, 2),
    "utf-8",
  );

  console.log("\nBefore continuing, request test USDC from the faucet:");
  console.log("  1. Go to https://faucet.circle.com");
  console.log('  2. Select "Arc Testnet" network');
  console.log(`  3. Paste your wallet address: ${wallet.address}`);
  console.log('  4. Click "Send USDC"');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) =>
    rl.question("\nPress Enter once faucet tokens have been sent... ", () => {
      rl.close();
      resolve();
    }),
  );

  console.log("\nCreating second wallet...");
  const secondWallet = (
    await client.createWallets({
      walletSetId: walletSet.id,
      blockchains: ["ARC-TESTNET"],
      count: 1,
      accountType: "EOA",
    })
  ).data?.wallets?.[0];

  if (!secondWallet) {
    throw new Error("Second wallet creation failed: no wallet returned");
  }

  console.log("Second wallet address:", secondWallet.address);
  console.log("\nSending 5 USDC to second wallet...");

  const txResponse = await client.createTransaction({
    blockchain: wallet.blockchain as TokenBlockchain,
    walletAddress: wallet.address,
    destinationAddress: secondWallet.address,
    amount: ["5"],
    tokenAddress: ARC_TESTNET_USDC,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  const txId = txResponse.data?.id;
  if (!txId) {
    throw new Error("Transaction creation failed: no ID returned");
  }

  console.log("Transaction ID:", txId);

  const terminalStates = new Set(["COMPLETE", "FAILED", "CANCELLED", "DENIED"]);
  let currentState: string | undefined = txResponse.data?.state;

  while (!currentState || !terminalStates.has(currentState)) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const poll = await client.getTransaction({ id: txId });
    const tx = poll.data?.transaction;
    currentState = tx?.state;
    console.log("Transaction state:", currentState);
    if (currentState === "COMPLETE" && tx?.txHash) {
      console.log(`Explorer: https://testnet.arcscan.app/tx/${tx.txHash}`);
    }
  }

  if (currentState !== "COMPLETE") {
    throw new Error(`Transaction ended in state: ${currentState}`);
  }

  const srcBalances = (await client.getWalletTokenBalance({ id: wallet.id })).data
    ?.tokenBalances;
  const secondBalances = (
    await client.getWalletTokenBalance({ id: secondWallet.id })
  ).data?.tokenBalances;

  console.log("\nSource wallet balances:");
  for (const balance of srcBalances ?? []) {
    console.log(`  ${balance.token?.symbol ?? "Unknown"}: ${balance.amount}`);
  }

  console.log("\nSecond wallet balances:");
  for (const balance of secondBalances ?? []) {
    console.log(`  ${balance.token?.symbol ?? "Unknown"}: ${balance.amount}`);
  }

  console.log("\nDone!");
}

main().catch((error) => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  console.error("Error:", error?.message || error);
  if (status) {
    console.error("HTTP status:", status);
  }
  if (data) {
    console.error("Circle response:", JSON.stringify(data, null, 2));
  }
  process.exit(1);
});