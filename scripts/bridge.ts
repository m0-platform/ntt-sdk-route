import {
  Chain,
  ChainAddress,
  ChainContext,
  Network,
  Signer,
  Wormhole,
  chainToPlatform,
  routes,
  wormhole,
} from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/platforms/evm";
import solana from "@wormhole-foundation/sdk/platforms/solana";
import "@wormhole-foundation/sdk-definitions-ntt";
import "@wormhole-foundation/sdk-evm-ntt";
import evmLoader from "@wormhole-foundation/sdk/evm";
import solanaLoader from "@wormhole-foundation/sdk/solana";
import "@wormhole-foundation/sdk-solana-ntt";
import { m0AutomaticRoute } from "../src/m0AutomaticRoute";

const wM = {
  Solana: "mzeroXDoBpRVhnEXBra27qzAMdxgpWVY3DzQW7xMVJp",
  Sepolia: "0x437cc33344a0B27A429f795ff6B469C72698B291",
  BaseSepolia: "0x437cc33344a0B27A429f795ff6B469C72698B291",
};

(async () => {
  const sourceChain = "Solana";
  const destinationChain = "BaseSepolia";

  await bridge({
    network: "Testnet",
    sourceChain,
    sourceToken: wM[sourceChain],
    destinationChain,
    destinationToken: wM[destinationChain],
    amount: "0.01",
  });
})();

async function bridge(params: {
  network: Network;
  sourceChain: Chain;
  sourceToken: string;
  destinationChain: Chain;
  destinationToken: string;
  amount: string;
}) {
  const wh = await wormhole(params.network, [evmLoader, solanaLoader]);
  const src = wh.getChain(params.sourceChain);
  const dst = wh.getChain(params.destinationChain);

  // get signers from env
  const srcSigner = await getSigner(src);
  const dstSigner = await getSigner(dst);
  const resolver = wh.resolver([m0AutomaticRoute()]);

  const tr = await routes.RouteTransferRequest.create(wh, {
    source: Wormhole.tokenId(params.sourceChain, params.sourceToken),
    destination: Wormhole.tokenId(
      params.destinationChain,
      params.destinationToken,
    ),
  });

  // resolve the transfer request to a set of routes that can perform it
  const foundRoutes = await resolver.findRoutes(tr);
  if (foundRoutes.length === 0) {
    throw new Error("No routes found");
  }

  const route = foundRoutes[0];

  const validated = await route.validate(tr, {
    amount: params.amount,
    options: route.getDefaultOptions(),
  });
  if (!validated.valid) throw validated.error;

  const quote = await route.quote(tr, validated.params);
  if (!quote.success) throw quote.error;

  const receipt = await route.initiate(
    tr,
    srcSigner.signer,
    quote,
    dstSigner.address,
  );

  console.log("Initiated transfer: ", receipt);
}

async function getSigner<N extends Network, C extends Chain>(
  chain: ChainContext<N, C>,
): Promise<{ address: ChainAddress<C>; signer: Signer<N, C> }> {
  const platform = chainToPlatform(chain.chain);
  let signer: Signer;
  switch (platform) {
    case "Solana":
      signer = await solana.getSigner(
        await chain.getRpc(),
        process.env.SOLANA_PRIVATE_KEY!,
      );
      break;
    case "Evm":
      signer = await evm.getSigner(
        await chain.getRpc(),
        process.env.PRIVATE_KEY!,
      );
      break;
    default:
      throw new Error("Unrecognized platform: " + platform);
  }

  console.debug(`Using signer ${signer.address()} on chain ${chain.chain}`);

  return {
    signer: signer as Signer<N, C>,
    address: Wormhole.chainAddress(chain.chain, signer.address()),
  };
}
