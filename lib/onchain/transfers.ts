import { getBlockNumber } from "@/lib/onchain/client";
import { getLogs as getRawLogs } from "@/lib/onchain/baseRpc";
import { normalizeAddress } from "@/lib/onchain/config";
import { ONCHAIN_TTLS, withOnchainCache } from "@/lib/onchain/cache";
import type { TokenTransfer } from "@/lib/onchain/types";

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export async function getTokenTransferLogs(tokenAddress: string, fromBlock?: number, toBlock?: number): Promise<TokenTransfer[]> {
  const latest = toBlock ?? await getBlockNumber();
  const start = Math.max(0, fromBlock ?? latest - 43_200);
  const cacheKey = `transfers:${normalizeAddress(tokenAddress)}:${start}:${latest}`;
  return withOnchainCache(cacheKey, ONCHAIN_TTLS.transfers, () => getTokenTransferLogsUncached(tokenAddress, start, latest));
}

async function getTokenTransferLogsUncached(tokenAddress: string, fromBlock: number, toBlock: number): Promise<TokenTransfer[]> {
  const chunkSize = 2_000;
  const transfers: TokenTransfer[] = [];
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(toBlock, start + chunkSize - 1);
    try {
      const logs = await getRawLogs({ address: normalizeAddress(tokenAddress), fromBlock: start, toBlock: end, topics: [TRANSFER_TOPIC] });
      for (const log of logs) {
        if (!log.topics[1] || !log.topics[2]) continue;
        transfers.push({
          txHash: log.transactionHash,
          logIndex: Number.parseInt(log.logIndex ?? "0x0", 16),
          blockNumber: Number.parseInt(log.blockNumber, 16),
          from: topicAddress(log.topics[1]),
          to: topicAddress(log.topics[2]),
          valueRaw: BigInt(log.data).toString()
        });
      }
    } catch {
      // Hot public RPC ranges can fail. Callers mark reconstructed holder/event data as partial.
    }
  }
  return transfers;
}

function topicAddress(topic: string) {
  return normalizeAddress(`0x${topic.slice(-40)}`);
}
