# MetaBridge - Symemeio

This branch is meant to be the "Master/general" contract for small projects ( in fact, it is right now our first implementation for a small project — it will be generalised later)

In this Branch for small/meme projects, we have the following contracts:
* Note that we do not have a Escrow.sol contract!!
* Gateway.sol is the interface between the native tokens and bridged tokens -- it converts/swaps one for another. For small projects, getway also has minting rights on native tokens —— with dlegated pause function to AI-live monitoring security firms
* SourceGateway.sol (FIXME) is the gateway of the source chain for non-burnable contracts (it is the essentially the same contract as in main -- FIXME insert and docstring)
* LayerZeroBridge.sol is as in the main branch the MetaBridge contract that interfaces with Layer Zero bridge contracts ( and specifies eg the oracle/DVN — DVN stands for Decentralised Validator Network) —— by default, this is the main bridge
* MuonBridge.sol is as in the main branch the MetaBridge contract that interfaces with Muon bridge contracts —— it is potentially available for Chains not supported by main bridge protocols such as Layer Zero
* Note that each new bridge integration would have a similar name (eg AxelarBridge.sol, etc... )
* For the token contracts, we have:

    + MBToken.sol is the Master contract for bridgeable (not native) tokens. Minting rights over bridgeable tokens are granted to Layer Zero
    + MetaSyme as an example of MB token for our first implementation
    + Symemeio.sol is the native token for Symemeio deployed on new chains. This native token is mintable/burnable on all new chains. Note that when a deployed small project is not mintable/burnable on the source chain, excess tokens deposited in the gateway are typically sent to a multisig ( an escrow contract of the initial chain could be deployed too )
 

