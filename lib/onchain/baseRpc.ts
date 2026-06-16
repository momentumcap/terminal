const DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";

export const BASE_RPC_URL = process.env.ALCHEMY_BASE_RPC_URL || (process.env.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "") || process.env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL;
const RPC_URLS = Array.from(new Set([
  process.env.ALCHEMY_BASE_RPC_URL || (process.env.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : ""),
  process.env.BASE_RPC_URL || "",
  DEFAULT_BASE_RPC_URL
].filter(Boolean)));

let rpcId = 1;

export async function rpc<T>(method: string, params: unknown[], retries = 2): Promise<T> {
  let lastError: unknown;
  for (const url of RPC_URLS) {
    try {
      return await rpcViaUrl<T>(url, method, params, retries);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All Base RPC providers failed");
}

async function rpcViaUrl<T>(url: string, method: string, params: unknown[], retries = 2): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), method === "eth_getLogs" ? 8_000 : 4_500);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Base RPC ${response.status}: ${response.statusText}`);
    const payload = await response.json();
    if (payload.error) throw new Error(`Base RPC ${payload.error.code}: ${payload.error.message}`);
    return payload.result as T;
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, 180 * (3 - retries)));
    return rpcViaUrl<T>(url, method, params, retries - 1);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getBlockNumber(): Promise<number> {
  const hex = await rpc<string>("eth_blockNumber", []);
  return Number.parseInt(hex, 16);
}

export async function getBlockByNumber(blockNumber: number) {
  return rpc<{ number: string; timestamp: string }>("eth_getBlockByNumber", [toHex(blockNumber), false]);
}

export async function ethCall(to: string, data: string, blockTag = "latest"): Promise<string> {
  return rpc<string>("eth_call", [{ to, data }, blockTag]);
}

export async function getLogs(params: { address?: string; fromBlock: number; toBlock: number; topics?: Array<string | null> }) {
  return rpc<Array<{ address: string; blockNumber: string; transactionHash: string; logIndex: string; topics: string[]; data: string }>>("eth_getLogs", [
    {
      address: params.address,
      fromBlock: toHex(params.fromBlock),
      toBlock: toHex(params.toBlock),
      topics: params.topics
    }
  ]);
}

export function toHex(value: number | bigint) {
  return `0x${BigInt(value).toString(16)}`;
}

export function pad32(hexAddress: string) {
  return `0x${hexAddress.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

export function strip0x(value: string) {
  return value.replace(/^0x/, "");
}

export function normalizeAddress(value: string) {
  return `0x${value.toLowerCase().replace(/^0x/, "")}`;
}
