import { ethCall, getBlockNumber, getLogs, normalizeAddress, pad32, strip0x } from "@/lib/onchain/baseRpc";

export const UNISWAP_V3_BASE_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
export const BASE_WETH = "0x4200000000000000000000000000000000000006";
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const UNISWAP_V3_FEES = [100, 500, 3000, 10000];
export const POOL_CREATED_TOPIC = "0x783cca1c0412dd0d695e784568c109dc9c0e5f9e33fdb9c0d1877b9b5d5d55d";
export const UNISWAP_V3_SWAP_TOPIC = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";
export const UNISWAP_V2_SWAP_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";
const TOKEN0_SELECTOR = "0x0dfe1681";
const TOKEN1_SELECTOR = "0xd21220a7";
const FEE_SELECTOR = "0xddca3f43";
const WINDOW_SPECS = [
  { window: "5m" as const, seconds: 5 * 60 },
  { window: "1h" as const, seconds: 60 * 60 },
  { window: "6h" as const, seconds: 6 * 60 * 60 },
  { window: "24h" as const, seconds: 24 * 60 * 60 }
];

export interface OwnPool {
  protocol: "uniswap_v3" | "uniswap_v2";
  address: string;
  token0: string;
  token1: string;
  quoteToken: "USDC" | "WETH" | "OTHER";
  quoteAddress: string;
  fee?: number;
}

export interface OwnTransactionWindow {
  window: "5m" | "1h" | "6h" | "24h";
  buys: number;
  sells: number;
  total: number;
  buyRatio: number;
  source: "BaseRPC";
  poolAddress: string;
  complete: boolean;
  fromBlock: number;
  toBlock: number;
  indexedLogCount: number;
}

export async function discoverUniswapV3Pools(tokenAddress: string): Promise<OwnPool[]> {
  const token = normalizeAddress(tokenAddress);
  const quotes = [
    { address: normalizeAddress(BASE_USDC), symbol: "USDC" as const },
    { address: normalizeAddress(BASE_WETH), symbol: "WETH" as const }
  ];
  const pools: OwnPool[] = [];

  for (const quote of quotes) {
    for (const fee of UNISWAP_V3_FEES) {
      const [token0, token1] = sortAddresses(token, quote.address);
      const pool = await getPool(token0, token1, fee);
      if (pool && !/^0x0{40}$/.test(pool)) {
        pools.push({ protocol: "uniswap_v3", address: pool, token0, token1, quoteToken: quote.symbol, quoteAddress: quote.address, fee });
      }
    }
  }

  return pools;
}

export async function inspectUniswapV3Pool(poolAddress: string, tokenAddress: string): Promise<OwnPool | null> {
  try {
    const [token0Result, token1Result, feeResult] = await Promise.all([
      ethCall(poolAddress, TOKEN0_SELECTOR),
      ethCall(poolAddress, TOKEN1_SELECTOR),
      ethCall(poolAddress, FEE_SELECTOR)
    ]);
    const token0 = normalizeAddress(`0x${strip0x(token0Result).slice(-40)}`);
    const token1 = normalizeAddress(`0x${strip0x(token1Result).slice(-40)}`);
    const token = normalizeAddress(tokenAddress);
    const usdc = normalizeAddress(BASE_USDC);
    const weth = normalizeAddress(BASE_WETH);
    if (token0 !== token && token1 !== token) return null;
    const quoteAddress = token0 === token ? token1 : token0;
    return {
      protocol: "uniswap_v3",
      address: normalizeAddress(poolAddress),
      token0,
      token1,
      quoteToken: quoteAddress === usdc ? "USDC" : quoteAddress === weth ? "WETH" : "OTHER",
      quoteAddress,
      fee: Number.parseInt(feeResult, 16)
    };
  } catch {
    return null;
  }
}

export async function inspectUniswapV2Pool(poolAddress: string, tokenAddress: string): Promise<OwnPool | null> {
  try {
    const [token0Result, token1Result] = await Promise.all([
      ethCall(poolAddress, TOKEN0_SELECTOR),
      ethCall(poolAddress, TOKEN1_SELECTOR)
    ]);
    const token0 = normalizeAddress(`0x${strip0x(token0Result).slice(-40)}`);
    const token1 = normalizeAddress(`0x${strip0x(token1Result).slice(-40)}`);
    const token = normalizeAddress(tokenAddress);
    const usdc = normalizeAddress(BASE_USDC);
    const weth = normalizeAddress(BASE_WETH);
    if (token0 !== token && token1 !== token) return null;
    const quoteAddress = token0 === token ? token1 : token0;
    return {
      protocol: "uniswap_v2",
      address: normalizeAddress(poolAddress),
      token0,
      token1,
      quoteToken: quoteAddress === usdc ? "USDC" : quoteAddress === weth ? "WETH" : "OTHER",
      quoteAddress
    };
  } catch {
    return null;
  }
}

export async function inspectKnownUniswapPool(poolAddress: string, tokenAddress: string): Promise<OwnPool | null> {
  return (await inspectUniswapV3Pool(poolAddress, tokenAddress)) ?? inspectUniswapV2Pool(poolAddress, tokenAddress);
}

export async function indexUniswapV3BuySellWindows(tokenAddress: string, pool: OwnPool): Promise<OwnTransactionWindow[]> {
  const latest = await getBlockNumber();
  const windowBlocks = await Promise.all(
    WINDOW_SPECS.map(async ({ window, seconds }) => ({
      window,
      seconds,
      fromBlock: estimateBaseBlockAtWindow(latest, seconds)
    }))
  );
  const swapTopic = pool.protocol === "uniswap_v3" ? UNISWAP_V3_SWAP_TOPIC : UNISWAP_V2_SWAP_TOPIC;
  const tokenIs0 = normalizeAddress(tokenAddress) === normalizeAddress(pool.token0);

  return Promise.all(windowBlocks.map(async ({ window, fromBlock, seconds }) => {
    const indexed = await withDeadline(
      getLogsChunked(pool.address, fromBlock, latest, swapTopic),
      { logs: [] as Awaited<ReturnType<typeof getLogs>>, complete: false, failedRanges: [{ fromBlock, toBlock: latest }] },
      windowDeadline(seconds)
    );
    let buys = 0;
    let sells = 0;
    let indexedLogCount = 0;
    for (const log of indexed.logs) {
      indexedLogCount += 1;
      const side = pool.protocol === "uniswap_v3" ? decodeV3SwapSide(log.data, tokenIs0) : decodeV2SwapSide(log.data, tokenIs0);
      if (side === "buy") buys += 1;
      if (side === "sell") sells += 1;
    }
    const total = buys + sells;
    const complete = indexed.complete && !indexed.failedRanges.some((range) => rangesOverlap(fromBlock, latest, range.fromBlock, range.toBlock));
    return { window, buys, sells, total, buyRatio: total ? buys / total : 0, source: "BaseRPC" as const, poolAddress: pool.address, complete, fromBlock, toBlock: latest, indexedLogCount };
  }));
}

async function getPool(token0: string, token1: string, fee: number): Promise<string | null> {
  const selector = "0x1698ee82";
  const data = `${selector}${pad32(token0).slice(2)}${pad32(token1).slice(2)}${fee.toString(16).padStart(64, "0")}`;
  const result = await ethCall(UNISWAP_V3_BASE_FACTORY, data);
  const word = strip0x(result).padStart(64, "0");
  const address = `0x${word.slice(-40)}`;
  return normalizeAddress(address);
}

async function getLogsChunked(address: string, fromBlock: number, toBlock: number, swapTopic: string) {
  const chunkSize = 1000;
  const out: Awaited<ReturnType<typeof getLogs>> = [];
  const failedRanges: Array<{ fromBlock: number; toBlock: number }> = [];
  for (let start = Math.max(0, fromBlock); start <= toBlock; start += chunkSize) {
    const end = Math.min(toBlock, start + chunkSize - 1);
    const result = await getLogsAdaptive(address, start, end, swapTopic);
    out.push(...result.logs);
    failedRanges.push(...result.failedRanges);
  }
  return { logs: out, complete: failedRanges.length === 0, failedRanges };
}

async function getLogsAdaptive(address: string, fromBlock: number, toBlock: number, swapTopic: string): Promise<{ logs: Awaited<ReturnType<typeof getLogs>>; failedRanges: Array<{ fromBlock: number; toBlock: number }> }> {
  try {
    return { logs: await getLogs({ address, fromBlock, toBlock, topics: [swapTopic] }), failedRanges: [] };
  } catch {
    if (toBlock - fromBlock <= 10) return { logs: [], failedRanges: [{ fromBlock, toBlock }] };
    const mid = Math.floor((fromBlock + toBlock) / 2);
    const left = await getLogsAdaptive(address, fromBlock, mid, swapTopic);
    const right = await getLogsAdaptive(address, mid + 1, toBlock, swapTopic);
    return { logs: [...left.logs, ...right.logs], failedRanges: [...left.failedRanges, ...right.failedRanges] };
  }
}

function estimateBaseBlockAtWindow(latestBlock: number, windowSeconds: number) {
  // Base targets roughly 2-second blocks. This estimate keeps live swap-window
  // analysis fast; incomplete/estimated ranges are surfaced as partial in the UI.
  return Math.max(0, latestBlock - Math.ceil(windowSeconds / 2) - 25);
}

function rangesOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number) {
  return aFrom <= bTo && bFrom <= aTo;
}

function windowDeadline(seconds: number) {
  if (seconds <= 5 * 60) return 1_500;
  if (seconds <= 60 * 60) return 2_500;
  if (seconds <= 6 * 60 * 60) return 4_000;
  return 6_000;
}

async function withDeadline<T>(promise: Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]);
  } catch {
    return fallback;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function decodeV3SwapSide(data: string, tokenIs0: boolean) {
  const words = strip0x(data).match(/.{1,64}/g) ?? [];
  const amount0 = int256(words[0] ?? "0");
  const amount1 = int256(words[1] ?? "0");
  const tokenAmount = tokenIs0 ? amount0 : amount1;
  if (tokenAmount < BigInt(0)) return "buy";
  if (tokenAmount > BigInt(0)) return "sell";
  return "unknown";
}

function decodeV2SwapSide(data: string, tokenIs0: boolean) {
  const words = strip0x(data).match(/.{1,64}/g) ?? [];
  const amount0In = BigInt(`0x${words[0] ?? "0"}`);
  const amount1In = BigInt(`0x${words[1] ?? "0"}`);
  const amount0Out = BigInt(`0x${words[2] ?? "0"}`);
  const amount1Out = BigInt(`0x${words[3] ?? "0"}`);
  const tokenIn = tokenIs0 ? amount0In : amount1In;
  const tokenOut = tokenIs0 ? amount0Out : amount1Out;
  if (tokenOut > BigInt(0)) return "buy";
  if (tokenIn > BigInt(0)) return "sell";
  return "unknown";
}

function int256(word: string) {
  const value = BigInt(`0x${word}`);
  const one = BigInt(1);
  const max = one << BigInt(255);
  return value >= max ? value - (one << BigInt(256)) : value;
}

function sortAddresses(a: string, b: string): [string, string] {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}
