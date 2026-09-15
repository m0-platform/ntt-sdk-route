import { Chain, TokenId, toNative } from "@wormhole-foundation/sdk-connect";

export async function assertSupportedPath(
  router: {
    getSupportedDestinationTokens(source: string, chain: Chain): Promise<TokenId[]>;
  },
  source: string,
  destination: string,
  chain: Chain,
): Promise<void> {
  const destinations = await router.getSupportedDestinationTokens(source, chain);
  const address = toNative(chain, destination).toString();
  if (!destinations.some((token) =>
    token.chain === chain && token.address.toString() === address,
  )) {
    throw new Error(`Unsupported token path ${source} -> ${destination} on ${chain}`);
  }
}
