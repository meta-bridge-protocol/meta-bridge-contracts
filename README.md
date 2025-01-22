# MetaBridge Contracts

This is our main repository.

MetaBridge is an interchain abstraction layer with a customizable security stack that enables projects to launch multichain tokens or make their existing tokens multichain.

## Organisation
There's two main implementations of the metabridge tech and contracts:
* Main Branch -- generic framework contract for large ("OG") protocols where protocols manage both an escrow and a gateway contract, and have control over both their native tokens and the bridged tokens
* Memebranch -- generic framework contract for smaller projects, where the gateway has minting rights over both the native and bridged (mb) tokens

These two branches will be kept up to date and improved

Then on top we have the protocol implementations:
* Large/OG protocols can typically fork and fine-tune the contracts in their own repos (and most variations will not be published here)
* Metabridge will implement on-demand variations for small projects, which will be in a branch under their name ( eg Symemeio ).

## Main Branch -- 
!FIXME!  -- internal note: rn "main" branch contains the large/og contracts, and the name "main" is not as explicit as the name "meme" for small projects. Wha'ts the best practice here? 2 different repos with name contracts_large_projects and contracts_small_projects? Or on repo as now, with the main branch only for docs, and two branches with explicit names? ??

In this "main" Branch dedicated to large projects, we have the following contracts:
* Escrow.sol manages the native balances of the gateway, and crucially, by removing excess native tokens from the gateway, also removes any incentive to try to hack the gateway. It can be seen as a restricted contract-form of a multi-sig safe.
* Gateway.sol is the interface between the native tokens and bridged tokens -- it converts/swaps one for another
* LayerZeroBridge.sol is the MetaBridge contract that interfaces with Layer Zero bridge contracts ( and specifies eg the oracle/DVN — DVN stands for Decentralised Validator Network) —— by default, this is the main bridge
* MuonBridge.sol is the MetaBridge contract that interfaces with Muon bridge contracts —— it is potentially available for Chains not supported by main bridge protocols such as Layer Zero
* Note that each new bridge integration would have a similar name (eg AxelarBridge.sol, etc... )
* MBToken.sol is the Master contract for bridgeable (not native) tokens. Minting rights over bridgeable tokens are granted to Layer Zero

As an example, in this main branch, we have also kept the bridgeable tokens of our first two implementations (Deus and Luv2Meme). These contracts inherit from MBToken.sol
* MetaDEUS.sol
* MetaLUV.sol


## Usage
  Enabling cross-chain transfers for a token using MetaBridge involves just a few simple steps.<br/>
  Follow the instructions below:
### 1. Deploy tokens 
  Deploy both the native token and the MB token on each chain you intend to support.

### 2. Deploy Gateway
  Deploy the gateway contract to enable seamless swapping between the native token and the MB token.

### 3. Deploy Escrow
  Escrow is where manages gateway liquidity through a predefined threshold amount.

### 4. Add token to the bridge
  Ask our team to add your token to the bridge.
