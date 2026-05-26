import { Chain, Network } from "@wormhole-foundation/sdk-connect";

export function getM0ChainId(chain: Chain, network: Network): number {
  // Solana doesn't have a network-specific identifier
  if (chain === "Solana") {
    return network === "Mainnet" ? 1399811149 : 1399811150;
  }

  const chains: Partial<Record<Chain, number>> = {
    // Mainnets
    Arbitrum: 42161,
    Avalanche: 43114,
    Base: 8453,
    Berachain: 80094,
    Ethereum: 1,
    HyperEVM: 999,
    Ink: 57073,
    Linea: 59144,
    Mantle: 5000,
    MegaETH: 4326,
    Monad: 143,
    Optimism: 10,
    Plasma: 9745,
    Plume: 98866,
    Polygon: 137,
    Sei: 1329,
    Moca: 2288,
    // Testnets
    ArbitrumSepolia: 421614,
    BaseSepolia: 84532,
    Sepolia: 11155111,
    OptimismSepolia: 11155420,
  };

  const chainId = chains[chain];

  if (!chainId) {
    throw new Error(`Unsupported chain: ${chain}`);
  }

  return chainId;
}
