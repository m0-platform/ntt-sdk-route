import { Chain, Network } from "@wormhole-foundation/sdk-connect";
import { NttExecutorRoute, NttRoute } from "@wormhole-foundation/sdk-route-ntt";
import { PublicKey } from "@solana/web3.js";

export function getExecutorConfig(
  network: Network = "Mainnet",
): NttExecutorRoute.Config {
  const svmChains: Chain[] = ["Solana"];
  const evmChains: Chain[] =
    network === "Mainnet"
      ? ["Ethereum", "Arbitrum", "Base", "Moca"]
      : ["Sepolia", "ArbitrumSepolia", "BaseSepolia"];

  const evmMToken = "0x866A2BF4E572CbcF37D5071A7a58503Bfb36be1b";
  const evmOverrides = Object.fromEntries(
    evmChains.map((chain) => [chain, { [evmMToken]: { gasLimit: 600_000n } }]),
  );

  return {
    ntt: {
      tokens: {
        M0: [
          ...svmChains.map((chain) => ({
            chain,
            token: "mzerojk9tg56ebsrEAhfkyc9VgKjTW2zDqp6C5mhjzH",
            manager: "mzp1q2j5Hr1QuLC3KFBCAUz5aUckT6qyuZKZ3WJnMmY",
            transceiver: [
              {
                type: "wormhole" as NttRoute.TransceiverType,
                address: PublicKey.default.toBase58(),
              },
            ],
            quoter: "Nqd6XqA8LbsCuG8MLWWuP865NV6jR1MbXeKxD4HLKDJ",
          })),
          ...evmChains.map((chain) => ({
            chain,
            token: evmMToken,
            manager: "0xaCffEC28C4eEe21C889a4e6C0704c540Ed9D4fDd",
            transceiver: [
              {
                type: "wormhole" as NttRoute.TransceiverType,
                address: "0xaCffEC28C4eEe21C889a4e6C0704c540Ed9D4fDd",
              },
            ],
          })),
        ],
      },
    },
    referrerFee: {
      feeDbps: 0n,
      perTokenOverrides: {
        Solana: {
          ["mzerojk9tg56ebsrEAhfkyc9VgKjTW2zDqp6C5mhjzH"]: {
            msgValue: 4_500_000n,
            gasLimit: 450_000n,
          },
        },
        ...evmOverrides,
      },
    },
  };
}
