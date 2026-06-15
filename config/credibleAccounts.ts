export const credibleAccountsConfig = {
  allowlistedHandles: ["bankrbot", "base", "jessepollak", "clankeronbase", "virtuals_io", "aerodromefi"],
  denylistedHandles: ["bankr_support", "base_helpdesk", "official_claims"],
  tier1Handles: ["bankrbot", "base", "jessepollak"],
  tier2Handles: ["aerodromefi", "virtuals_io", "clankeronbase"],
  watchHandles: ["0xwork", "litcoin", "helixa"],
  weightedHandles: {
    bankrbot: 30,
    base: 28,
    jessepollak: 25,
    aerodromefi: 18,
    virtuals_io: 16
  } as Record<string, number>,
  builderKeywords: ["builder", "founder", "agent", "ai", "base", "protocol", "dev", "engineer", "studio", "research"],
  suspiciousKeywords: ["support", "airdrop", "claim", "giveaway", "double", "official help", "refund", "recover"]
};
