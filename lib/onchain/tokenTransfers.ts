import { getBlockNumber, getLogs, normalizeAddress } from "@/lib/onchain/baseRpc";

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface TransferWindowSummary {
  transfers24h: number;
  uniqueSenders24h: number;
  uniqueReceivers24h: number;
}

export async function summarizeTransfers24h(tokenAddress: string): Promise<TransferWindowSummary> {
  const latest = await getBlockNumber();
  const fromBlock = latest - 43200;
  const logs = await getTransferLogsChunked(tokenAddress, fromBlock, latest);
  const senders = new Set<string>();
  const receivers = new Set<string>();
  for (const log of logs) {
    if (log.topics[1]) senders.add(topicAddress(log.topics[1]));
    if (log.topics[2]) receivers.add(topicAddress(log.topics[2]));
  }
  return { transfers24h: logs.length, uniqueSenders24h: senders.size, uniqueReceivers24h: receivers.size };
}

async function getTransferLogsChunked(address: string, fromBlock: number, toBlock: number) {
  const chunkSize = 2000;
  const out: Awaited<ReturnType<typeof getLogs>> = [];
  for (let start = Math.max(0, fromBlock); start <= toBlock; start += chunkSize) {
    const end = Math.min(toBlock, start + chunkSize - 1);
    try {
      const logs = await getLogs({ address, fromBlock: start, toBlock: end, topics: [TRANSFER_TOPIC] });
      out.push(...logs);
    } catch {
      // Public RPCs can reject hot ranges. Partial transfer summaries are still useful as a freshness signal.
    }
  }
  return out;
}

function topicAddress(topic: string) {
  return normalizeAddress(`0x${topic.slice(-40)}`);
}
