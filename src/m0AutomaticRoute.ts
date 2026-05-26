import {
  AccountAddress,
  AttestedTransferReceipt,
  Chain,
  ChainAddress,
  ChainContext,
  CompletedTransferReceipt,
  Network,
  RedeemedTransferReceipt,
  Signer,
  TokenId,
  TransferState,
  Wormhole,
  WormholeMessageId,
  amount,
  canonicalAddress,
  chainToPlatform,
  finality,
  isAttested,
  isRedeemed,
  isSourceFinalized,
  isSourceInitiated,
  routes,
  signSendWait,
} from "@wormhole-foundation/sdk-connect";
import { register as registerNttDefinitions } from "@wormhole-foundation/sdk-definitions-ntt";
import { register as registerEvmNtt } from "@wormhole-foundation/sdk-evm-ntt";
import { register as registerSolanaNtt } from "@wormhole-foundation/sdk-solana-ntt";
import { EvmNtt } from "@wormhole-foundation/sdk-evm-ntt";

import {
  addChainId,
  EvmAddress,
  EvmChains,
  EvmUnsignedTransaction,
} from "@wormhole-foundation/sdk-evm";
import "@wormhole-foundation/sdk-solana";
import {
  nttExecutorRoute,
  NttExecutorRoute,
  NttRoute,
} from "@wormhole-foundation/sdk-route-ntt";
import { Ntt, NttWithExecutor } from "@wormhole-foundation/sdk-definitions-ntt";
import {
  SolanaChains,
  SolanaUnsignedTransaction,
} from "@wormhole-foundation/sdk-solana";
import {
  TransactionMessage,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";
import { getExecutorConfig } from "./executor";
import { SvmRouter } from "./svm";
import { EvmRouter } from "./evm";
import { getM0ChainId } from "./chainIds";

type Op = NttRoute.Options;
type Tp = routes.TransferParams<Op>;
type Vr = routes.ValidationResult<Op>;

type Vp = NttRoute.ValidatedParams;
type QR = routes.QuoteResult<Op, Vp>;
type Q = routes.Quote<Op, Vp>;

type R = NttRoute.AutomaticTransferReceipt;

let registered = false;
function ensureM0Registered(): void {
  if (registered) return;
  registered = true;
  registerNttDefinitions();
  registerEvmNtt();
  registerSolanaNtt();
}

/**
 * Factory for M0AutomaticRoute. Calling this is the supported way to obtain
 * the route constructor — it ensures NTT protocol implementations are
 * registered with the Wormhole SDK before any route construction. Idempotent.
 *
 * Add the result to your Wormhole Connect routes config:
 *
 *   import { m0AutomaticRoute } from "@m0-foundation/ntt-sdk-route";
 *   const config = { routes: [m0AutomaticRoute(), ...] };
 */
export function m0AutomaticRoute(): routes.RouteConstructor {
  ensureM0Registered();
  return M0AutomaticRoute as routes.RouteConstructor;
}

export class M0AutomaticRoute<N extends Network>
  extends routes.AutomaticRoute<N, Op, Vp, R>
  implements routes.StaticRouteMethods<typeof M0AutomaticRoute>
{
  static NATIVE_GAS_DROPOFF_SUPPORTED: boolean = false;
  static EXECUTOR_ENTRYPOINT = "0x22f04a6cd935bfa3b4d000a4e3d4079adb148198";
  static meta = { name: "M0AutomaticRoute", provider: "M0" };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }

  static isPlatformSupported(platform: string): boolean {
    return platform == "Evm" || platform == "Solana";
  }

  static supportedChains(network: Network): Chain[] {
    switch (network) {
      case "Mainnet":
        return ["Ethereum", "Arbitrum", "Base", "Moca", "Solana"];
      case "Testnet":
        return [
          "Sepolia",
          "ArbitrumSepolia",
          "BaseSepolia",
          "Solana",
        ];
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  static getContracts(chainContext: ChainContext<Network>): Ntt.Contracts {
    switch (chainContext.chain) {
      case "Ethereum":
      case "Arbitrum":
      case "Base":
      case "Moca":
      case "Sepolia":
      case "ArbitrumSepolia":
      case "BaseSepolia":
        return {
          token: "0x866A2BF4E572CbcF37D5071A7a58503Bfb36be1b",
          manager: "0xD925C84b55E4e44a53749fF5F2a5A13F63D128fd",
          transceiver: {
            wormhole: "0xaCffEC28C4eEe21C889a4e6C0704c540Ed9D4fDd",
          },
        };
      case "Solana":
        return {
          token: "mzerojk9tg56ebsrEAhfkyc9VgKjTW2zDqp6C5mhjzH",
          transceiver: {},
          manager: "mzp1q2j5Hr1QuLC3KFBCAUz5aUckT6qyuZKZ3WJnMmY",
          quoter: "Nqd6XqA8LbsCuG8MLWWuP865NV6jR1MbXeKxD4HLKDJ",
        };
      default:
        throw new Error(`Unsupported chain: ${chainContext.chain}`);
    }
  }

  static async supportedSourceTokens(
    fromChain: ChainContext<Network>,
  ): Promise<TokenId[]> {
    if (chainToPlatform(fromChain.chain) === "Solana") {
      const router = await SvmRouter.fromChainContext(fromChain);
      return await router.getSupportedSourceTokens();
    }
    {
      const router = await EvmRouter.fromChainContext(fromChain);
      return router.getSupportedSourceTokens();
    }
  }

  static async supportedDestinationTokens<N extends Network>(
    token: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    if (chainToPlatform(fromChain.chain) === "Solana") {
      const router = await SvmRouter.fromChainContext(fromChain);
      return await router.getSupportedDestinationTokens(
        token.address.toString(),
        toChain.chain,
      );
    } else {
      const router = await EvmRouter.fromChainContext(fromChain);
      return await router.getSupportedDestinationTokens(
        token.address.toString(),
        toChain.chain,
      );
    }
  }

  static isProtocolSupported<N extends Network>(
    chain: ChainContext<N>,
  ): boolean {
    return M0AutomaticRoute.supportedChains(chain.network).includes(
      chain.chain,
    );
  }

  getDefaultOptions(): Op {
    return NttRoute.AutomaticOptions;
  }

  async isAvailable(_: routes.RouteTransferRequest<N>): Promise<boolean> {
    return true;
  }

  async validate(
    request: routes.RouteTransferRequest<N>,
    params: Tp,
  ): Promise<Vr> {
    const options = params.options ?? this.getDefaultOptions();

    const parsedAmount = amount.parse(params.amount, request.source.decimals);
    // The trimmedAmount may differ from the parsedAmount if the parsedAmount includes dust
    const trimmedAmount = NttRoute.trimAmount(
      parsedAmount,
      request.destination.decimals,
    );

    const fromContracts = M0AutomaticRoute.getContracts(request.fromChain);
    const toContracts = M0AutomaticRoute.getContracts(request.toChain);

    const validatedParams: Vp = {
      amount: params.amount,
      normalizedParams: {
        amount: trimmedAmount,
        sourceContracts: fromContracts,
        destinationContracts: toContracts,
        options: {
          queue: false,
          automatic: true,
        },
      },
      options,
    };
    return { valid: true, params: validatedParams };
  }

  async quote(
    request: routes.RouteTransferRequest<N>,
    params: Vp,
  ): Promise<QR> {
    const { fromChain, toChain } = request;

    const dstAmount = amount.scale(
      params.normalizedParams.amount,
      request.destination.decimals,
    );

    const result: QR = {
      success: true,
      params,
      sourceToken: {
        token: request.source.id,
        amount: params.normalizedParams.amount,
      },
      destinationToken: {
        token: request.destination.id,
        amount: dstAmount,
      },
      relayFee: {
        token: Wormhole.tokenId(fromChain.chain, "native"),
        amount: amount.fromBaseUnits(
          1_500_000n, // Rough estimation
          fromChain.config.nativeTokenDecimals,
        ),
      },
      destinationNativeGas: amount.fromBaseUnits(
        0n,
        toChain.config.nativeTokenDecimals,
      ),
      eta: finality.estimateFinalityTime(request.fromChain.chain),
    };

    return result;
  }

  async initiate(
    request: routes.RouteTransferRequest<N>,
    signer: Signer,
    quote: Q,
    to: ChainAddress,
  ): Promise<R> {
    const { params } = quote;
    const { fromChain } = request;
    const sender = Wormhole.parseAddress(signer.chain(), signer.address());
    const platform = chainToPlatform(fromChain.chain);
    const transferAmount = amount.units(params.normalizedParams.amount);
    const options = params.normalizedParams.options;

    if (!M0AutomaticRoute.isPlatformSupported(platform))
      throw new Error(`Unsupported platform ${platform}`);

    const sourceToken = canonicalAddress(request.source.id);
    const destinationToken = canonicalAddress(request.destination.id);

    const initXfer =
      platform === "Evm"
        ? // for EVM call transferMLike function
          this.transferMLike(
            fromChain,
            // @ts-ignore
            sender,
            transferAmount,
            to,
            sourceToken,
            destinationToken,
            options,
          )
        : // for Solana use custom transfer instruction
          this.transferSolanaExtension(
            fromChain,
            // @ts-ignore
            sender,
            transferAmount,
            to,
            sourceToken,
            destinationToken,
          );

    const txids = await signSendWait(fromChain, initXfer, signer);

    return {
      from: fromChain.chain,
      to: to.chain,
      state: TransferState.SourceInitiated,
      originTxs: txids,
      params,
    };
  }

  /**
   * Modified from EvmNtt `transfer` function to call `transferMLikeToken` instead
   * https://github.com/wormhole-foundation/native-token-transfers/blob/main/evm/ts/src/ntt.ts#L461
   */
  async *transferMLike<N extends Network, C extends EvmChains>(
    ctx: ChainContext<Network>,
    sender: AccountAddress<C>,
    amount: bigint,
    destination: ChainAddress,
    sourceToken: string,
    destinationToken: string,
    options: Ntt.TransferOptions,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddress = new EvmAddress(sender).toString();
    const chainId = BigInt(getM0ChainId(ctx.chain, ctx.network));

    const router = await EvmRouter.fromChainContext(ctx);

    const approval = await router.getSpendApproval(
      amount,
      senderAddress,
      sourceToken,
    );
    if (approval) {
      yield new EvmUnsignedTransaction<N, C>(
        addChainId(approval, chainId),
        ctx.network as N,
        ctx.chain as C,
        "M0 Extension spend approval",
        false,
      );
    }

    // Request relay through executor
    const quote = await this.getExecutorQuote(
      ctx.chain,
      destination.chain,
      amount,
    );

    const transfer = await router.buildSendTokenTransaction(
      amount,
      senderAddress,
      sourceToken,
      destinationToken,
      destination.chain,
      destination.address.toString(),
      quote,
    );

    yield new EvmUnsignedTransaction<N, C>(
      addChainId(transfer, chainId),
      ctx.network as N,
      ctx.chain as C,
      "M0 Extension Bridge",
      false,
    );

    return;
  }

  async *transferSolanaExtension<N extends Network, C extends SolanaChains>(
    ctx: ChainContext<Network>,
    sender: AccountAddress<C>,
    amount: bigint,
    recipient: ChainAddress,
    sourceToken: string,
    destinationToken: string,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    const router = await SvmRouter.fromChainContext(ctx);
    const tokenSender = new PublicKey(sender.address);

    // Convert principal amount to UI amount if mint has scaled-ui config
    amount = await SvmRouter.applyScaledUiMultiplier(
      router.connection,
      new PublicKey(sourceToken),
      amount,
    );

    // Use custom transfer instruction (not NTT)
    const ixs = [
      await router.buildSendTokenInstruction(
        amount,
        tokenSender,
        sourceToken,
        destinationToken,
        recipient.chain,
        recipient.address.toString(),
      ),
    ];

    // Request relay
    ixs.push(
      await router.buildExecutorRelayInstruction(
        tokenSender,
        await this.getExecutorQuote(ctx.chain, recipient.chain, amount),
        recipient.chain,
      ),
    );

    // Get address table from Wormhole resolver
    const lut = await router.getAddressLookupTableAccounts();

    const messageV0 = new TransactionMessage({
      payerKey: tokenSender,
      instructions: ixs,
      recentBlockhash: (await router.connection.getLatestBlockhash()).blockhash,
    }).compileToV0Message([lut]);

    yield new SolanaUnsignedTransaction<N, C>(
      { transaction: new VersionedTransaction(messageV0) },
      ctx.network as N,
      ctx.chain as C,
      "M0 Extension Bridge",
      false,
    );

    return;
  }

  public override async *track(receipt: R, timeout?: number) {
    const isEvmPlatform = (chain: Chain) => chainToPlatform(chain) === "Evm";

    if (isSourceInitiated(receipt) || isSourceFinalized(receipt)) {
      const { txid } = receipt.originTxs[receipt.originTxs.length - 1]!;

      const vaa = await this.wh.getVaa(txid, "Ntt:WormholeTransfer", timeout);
      if (!vaa) {
        throw new Error(`No VAA found for transaction: ${txid}`);
      }

      const msgId: WormholeMessageId = {
        chain: vaa.emitterChain,
        emitter: vaa.emitterAddress,
        sequence: vaa.sequence,
      };

      receipt = {
        ...receipt,
        state: TransferState.Attested,
        attestation: {
          id: msgId,
          attestation: vaa,
        },
      } satisfies AttestedTransferReceipt<NttRoute.AutomaticAttestationReceipt> as R;

      yield receipt;
    }

    const toChain = this.wh.getChain(receipt.to);
    const ntt = await toChain.getProtocol("Ntt", {
      ntt: M0AutomaticRoute.getContracts(toChain),
    });

    if (isAttested(receipt)) {
      const {
        attestation: { attestation: vaa },
      } = receipt;

      if (await ntt.getIsApproved(vaa)) {
        receipt = {
          ...receipt,
          state: TransferState.DestinationInitiated,
          // TODO: check for destination event transactions to get dest Txids
        } satisfies RedeemedTransferReceipt<NttRoute.AutomaticAttestationReceipt>;
        yield receipt;
      }
    }

    if (isRedeemed(receipt)) {
      const {
        attestation: { attestation: vaa },
      } = receipt;
      const payload =
        vaa.payloadName === "WormholeTransfer"
          ? vaa.payload
          : vaa.payload["payload"];

      const isExecuted = isEvmPlatform(receipt.to)
        ? await (ntt as EvmNtt<N, EvmChains>).manager.isMessageExecuted(
            Ntt.messageDigest(vaa.emitterChain, payload["nttManagerPayload"]),
          )
        : await ntt.getIsExecuted(vaa);

      if (isExecuted) {
        receipt = {
          ...receipt,
          state: TransferState.DestinationFinalized,
        } satisfies CompletedTransferReceipt<NttRoute.AutomaticAttestationReceipt>;
        yield receipt;
      }
    }

    yield receipt;
  }

  private async getExecutorQuote(
    sourceChain: Chain,
    destinationChain: Chain,
    amount: bigint,
  ): Promise<NttWithExecutor.Quote> {
    const executorRoute = nttExecutorRoute(getExecutorConfig(this.wh.network));
    const routeInstance = new executorRoute(this.wh);

    const resolveM = (chain: Chain) => {
      if (chainToPlatform(chain) === "Solana")
        return "mzerojk9tg56ebsrEAhfkyc9VgKjTW2zDqp6C5mhjzH";
      return "0x866A2BF4E572CbcF37D5071A7a58503Bfb36be1b";
    };

    const transferRequest = await routes.RouteTransferRequest.create(this.wh, {
      source: Wormhole.tokenId(sourceChain, resolveM(sourceChain)),
      destination: Wormhole.tokenId(
        destinationChain,
        resolveM(destinationChain),
      ),
    });

    const validated = await routeInstance.validate(transferRequest, {
      amount: amount.toString(),
    });
    if (!validated.valid) {
      throw new Error(`Validation failed: ${validated.error.message}`);
    }

    return await routeInstance.fetchExecutorQuote(
      transferRequest,
      validated.params as NttExecutorRoute.ValidatedParams,
    );
  }
}
