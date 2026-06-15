import { createPublicClient, getContract, http, webSocket, type Abi, type Address, type Hex } from "viem";
import { base } from "viem/chains";
import { onchainConfig } from "@/lib/onchain/config";

export const erc20Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "getOwner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "event", name: "Transfer", inputs: [{ indexed: true, name: "from", type: "address" }, { indexed: true, name: "to", type: "address" }, { indexed: false, name: "value", type: "uint256" }] }
] as const satisfies Abi;

export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(onchainConfig.baseRpcUrl, { retryCount: 2, timeout: 12_000 })
});

export const baseAlchemyClient = onchainConfig.alchemyBaseRpcUrl
  ? createPublicClient({ chain: base, transport: http(onchainConfig.alchemyBaseRpcUrl, { retryCount: 2, timeout: 12_000 }) })
  : null;

export const baseWsClient = onchainConfig.baseWsUrl
  ? createPublicClient({ chain: base, transport: webSocket(onchainConfig.baseWsUrl, { retryCount: 2, timeout: 12_000 }) })
  : null;

export function getBaseClient() {
  return baseAlchemyClient ?? basePublicClient;
}

export async function getBlockNumber() {
  return Number(await getBaseClient().getBlockNumber());
}

export async function getBalance(address: string) {
  return getBaseClient().getBalance({ address: address as Address });
}

export async function readContract<T = unknown>(address: string, abi: Abi, functionName: string, args: unknown[] = []) {
  return getBaseClient().readContract({ address: address as Address, abi, functionName, args }) as Promise<T>;
}

export async function safeReadContract<T = unknown>(address: string, abi: Abi, functionName: string, args: unknown[] = []): Promise<T | null> {
  try {
    return await readContract<T>(address, abi, functionName, args);
  } catch {
    return null;
  }
}

export async function multicall(contracts: Array<{ address: string; abi: Abi; functionName: string; args?: unknown[] }>) {
  return getBaseClient().multicall({
    allowFailure: true,
    contracts: contracts.map((contract) => ({
      address: contract.address as Address,
      abi: contract.abi,
      functionName: contract.functionName,
      args: contract.args ?? []
    }))
  });
}

export async function getLogs(params: { address?: string; fromBlock: number; toBlock: number; event?: Abi[number]; topics?: Hex[] }) {
  return getBaseClient().getLogs({
    address: params.address as Address | undefined,
    fromBlock: BigInt(params.fromBlock),
    toBlock: BigInt(params.toBlock),
    event: params.event as never,
    args: undefined,
    strict: false
  }) as Promise<Array<{ data: Hex; topics: [Hex, ...Hex[]]; transactionHash: Hex; blockNumber: bigint; logIndex?: number }>>;
}

export async function getTransaction(hash: string) {
  return getBaseClient().getTransaction({ hash: hash as Hex });
}

export async function getTransactionReceipt(hash: string) {
  return getBaseClient().getTransactionReceipt({ hash: hash as Hex });
}

export async function getCode(address: string) {
  return getBaseClient().getCode({ address: address as Address });
}

export function erc20Contract(address: string) {
  return getContract({ address: address as Address, abi: erc20Abi, client: getBaseClient() });
}
