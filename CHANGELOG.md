# @m0-foundation/ntt-sdk-route

## 0.1.1

### Patch Changes

- 4ea26e5: use 600,000 gas limit for EVM chains, add Moca

## 0.1.0

### Minor Changes

- 02d524f: **Breaking:** `M0AutomaticRoute` no longer registers NTT protocols on class load (the `static {}` block has been removed). The supported entry point is now the new `m0AutomaticRoute()` factory function, which lazily registers NTT protocols on first invocation and returns the route constructor.

  ### Migration

  ```diff
  - import { M0AutomaticRoute } from "@m0-foundation/ntt-sdk-route";
  + import { m0AutomaticRoute } from "@m0-foundation/ntt-sdk-route";

    const config = {
      routes: [
  -     M0AutomaticRoute,
  +     m0AutomaticRoute(),
        // ...
      ],
    };
  ```

  The `M0AutomaticRoute` class is still exported (e.g. for type annotations and advanced subclassing), but using it directly without first calling `ensureM0Registered()`-equivalent register functions will fail at runtime with "no protocols registered for X:Ntt". The factory wraps registration for you.

  ### Why

  The previous `static {}` block registered NTT protocols as a side effect of class load (basically import time). With sdk-\*-ntt v5 explicitly removing auto-registration on import, m0 was the last library still doing implicit on-load registration in this dependency chain. The factory pattern matches what bridge-monorepo's other route wrappers (cctp, base-bridge, NTT) do — register lazily on factory invocation, triggered by the consumer's intentional use of the API.

  ### Other changes in this release

  - Migrate `routes` namespace value-import from the deprecated `@wormhole-foundation/sdk-connect` barrel to the subpath (`@wormhole-foundation/sdk-connect/routes`). Type/value surface is identical.
  - Bump `@wormhole-foundation/sdk`, `sdk-connect`, `sdk-evm`, `sdk-solana` from 4.9.1 → 4.18.0 (subpath only available in 4.14+).
  - Bump NTT family (`sdk-definitions-ntt`, `sdk-evm-ntt`, `sdk-solana-ntt`, `sdk-route-ntt`) from 4.0.14 → 5.0.2.

## 0.0.30

### Patch Changes

- 441e35d: Fix gas overrides

## 0.0.29

### Patch Changes

- 9dbb027: update license to BSL 1.1

## 0.0.28

### Patch Changes

- e7d26d6: fix: replace NodeWallet with browser-compatible dummyWallet

## 0.0.27

### Patch Changes

- f7c9001: fix: use native addresses in getSupportedSourceTokens and getSupportedDestinationTokens

## 0.0.24

### Patch Changes

- 81a6135: bump dependencies

## 0.0.23

### Patch Changes

- da80aa6: Base and BaseSepolia support

## 0.0.9

### Patch Changes

- cc163e0: fix Solana destination tokens

## 0.0.8

### Patch Changes

- 2a19beb: Import Solana packages so native address type gets registered

## 0.0.7

### Patch Changes

- 0bf1158: Import Solana packages so native address type gets registered

## 0.0.6

### Patch Changes

- c05512a: Solana support

## 0.0.5

### Patch Changes

- ecc5c4a: bump wormhole ntt sdk

## 0.0.4

### Patch Changes

- 85688fd: Check source token in supportedDestinationTokens

## 0.0.3

### Patch Changes

- c909880: Add license and repository url

## 0.0.2

### Patch Changes

- f8e8290: Make package public

## 0.0.1

### Patch Changes

- 0d2ae76: Initial version
