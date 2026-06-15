export const mockBankrLaunches = [
  {
    activityId: "mock-alpha-1",
    status: "deployed",
    tokenName: "Agent Yield Index",
    tokenSymbol: "AYI",
    chain: "base",
    tokenAddress: "0x1111111111111111111111111111111111111111",
    timestamp: Date.now() - 1000 * 60 * 12,
    creator: { handle: "bankrbot", name: "Bankr", followers: 128000, verified: true, profileUrl: "https://x.com/bankrbot", createdAt: "2023-01-11T00:00:00.000Z" },
    launchPostUrl: "https://x.com/bankrbot/status/mock",
    launchText: "@bankrbot launch Agent Yield Index on Base"
  },
  {
    activityId: "mock-alpha-2",
    status: "deployed",
    tokenName: "Base Builder Radar",
    tokenSymbol: "RADAR",
    chain: "base",
    tokenAddress: "0x3333333333333333333333333333333333333333",
    timestamp: Date.now() - 1000 * 60 * 47,
    creator: { handle: "base", name: "Base", followers: 920000, verified: true, profileUrl: "https://x.com/base", createdAt: "2022-02-01T00:00:00.000Z" },
    launchPostUrl: "https://x.com/base/status/mock",
    launchText: "deploy a token called Base Builder Radar"
  },
  {
    activityId: "mock-risk-1",
    status: "deployed",
    tokenName: "Official Claim Rewards",
    tokenSymbol: "CLAIM",
    chain: "base",
    tokenAddress: "0x5555555555555555555555555555555555555555",
    timestamp: Date.now() - 1000 * 60 * 6,
    creator: { handle: "base_helpdesk", name: "Base Support", followers: 380, verified: false, profileUrl: "https://x.com/base_helpdesk", createdAt: "2026-05-01T00:00:00.000Z" },
    launchText: "claim official rewards now"
  }
];
