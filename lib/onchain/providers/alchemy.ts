import { onchainConfig, normalizeAddress } from "@/lib/onchain/config";
import { withProviderGuard } from "@/lib/onchain/rateLimit";

export function isAlchemyConfigured() {
  return Boolean(onchainConfig.alchemyBaseRpcUrl);
}

async function alchemyRpc<T>(method: string, params: unknown[]): Promise<T> {
  if (!onchainConfig.alchemyBaseRpcUrl) throw new Error("Alchemy Base RPC missing");
  return withProviderGuard("alchemy", async () => {
    const response = await fetch(onchainConfig.alchemyBaseRpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Alchemy ${response.status}`);
    const json = await response.json();
    if (json.error) throw new Error(json.error.message);
    return json.result as T;
  }, { concurrency: 4, timeoutMs: 15_000 });
}

export async function getTokenMetadata(address: string) {
  return alchemyRpc("alchemy_getTokenMetadata", [normalizeAddress(address)]);
}

export async function getAssetTransfers(address: string) {
  return alchemyRpc<{ transfers?: unknown[] }>("alchemy_getAssetTransfers", [{
    fromBlock: "0x0",
    toBlock: "latest",
    contractAddresses: [normalizeAddress(address)],
    category: ["erc20"],
    maxCount: "0x64",
    order: "desc"
  }]);
}

export async function getTokenBalances(wallet: string) {
  return alchemyRpc("alchemy_getTokenBalances", [normalizeAddress(wallet), "erc20"]);
}
