import { EndpointId } from '@layerzerolabs/lz-definitions'

import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

const bscTestContract: OmniPointHardhat = {
  eid: EndpointId.BSC_V2_TESTNET,
  contractName: 'MetaOApp',
}

const fujiContract: OmniPointHardhat = {
  eid: EndpointId.AVALANCHE_V2_TESTNET,
  contractName: 'MetaOApp',
}

const config: OAppOmniGraphHardhat = {
    contracts: [
        {
            contract: fujiContract,
        },
        {
            contract: bscTestContract,
        }
    ],
    connections: [
        {
            from: fujiContract,
            to: bscTestContract,
            config: {
                // Required Send Library Address on Fantom
                sendLibrary: "0x69BF5f48d2072DfeBc670A1D19dff91D0F4E8170",
                receiveLibraryConfig: {
                  // Required Receive Library Address on Fantom
                  receiveLibrary: "0x819F0FAF2cb1Fba15b9cB24c9A2BDaDb0f895daf",
                  // Optional Grace Period for Switching Receive Library Address on Fantom
                  gracePeriod: BigInt(0),
                },
                // Optional Send Configuration
                // @dev Controls how the `from` chain sends messages to the `to` chain.
                // @notice these parameters are passed to the layer zero executor ( private repo in this organitation )
                // these configs are part of the layero protocol —— if we want variable speed,
                // we will define that in the MuonDNVconfig.sol, which will pass the "dynamic speed config" to the executor
              
                sendConfig: {
                  ulnConfig: {
                    // The number of block confirmations to wait on Fantom chain before emitting the message from the source chain ("this").
                    confirmations: BigInt(3),
                    // The address of the DVNs you will pay to verify a sent message on the source chain (Fantom).
                    // The destination tx will wait until ALL `requiredDVNs` verify the message.
                    requiredDVNs: [
                        "0xC3DaA1F175A48448fE210674260b315CbC4f9504",
                    ],
                    // The address of the DVNs you will pay to verify a sent message on the source chain (Fantom).
                    // The destination tx will wait until the configured threshold of `optionalDVNs` verify a message.
                    optionalDVNs: [
                    ],
                    // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
                    optionalDVNThreshold: 0,
                  },
                },
                // Optional Receive Configuration
                // @dev Controls how the `from` chain receives messages from the `to` chain.
                receiveConfig: {
                  ulnConfig: {
                    // The number of block confirmations to expect from the `to` chain (Fantom).
                    confirmations: BigInt(3),
                    // The address of the DVNs your `receiveConfig` expects to receive verifications from on the `from` chain ("this").
                    // The `from` chain's OApp will wait until the configured threshold of `requiredDVNs` verify the message.
                    requiredDVNs: [
                        "0xC3DaA1F175A48448fE210674260b315CbC4f9504",
                    ],
                    // The address of the `optionalDVNs` you expect to receive verifications from on the `from` chain ("this").
                    // The destination tx will wait until the configured threshold of `optionalDVNs` verify the message.
                    optionalDVNs: [
                    ],
                    // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
                    optionalDVNThreshold: 0,
                  },
                },
            }
        },
        {
            from: bscTestContract,
            to: fujiContract,
            config: {
                sendLibrary: "0x55f16c442907e86D764AFdc2a07C2de3BdAc8BB7",
                receiveLibraryConfig: {
                  receiveLibrary: "0x188d4bbCeD671A7aA2b5055937F79510A32e9683",
                  gracePeriod: BigInt(0),
                },
                // Optional Send Configuration
                // @dev Controls how the `from` chain sends messages to the `to` chain.
                sendConfig: {
                  ulnConfig: {
                    confirmations: BigInt(3),
                    // The destination tx will wait until ALL `requiredDVNs` verify the message.
                    requiredDVNs: [
                        "0xac58dB20BD970f9e856DF1732499dEf7B727BAe2",
                    ],
                    // The destination tx will wait until the configured threshold of `optionalDVNs` verify a message.
                    optionalDVNs: [
                    ],
                    // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
                    optionalDVNThreshold: 0,
                  },
                },
                // Optional Receive Configuration
                // @dev Controls how the `from` chain receives messages from the `to` chain.
                receiveConfig: {
                  ulnConfig: {
                    confirmations: BigInt(3),
                    // The `from` chain's OApp will wait until the configured threshold of `requiredDVNs` verify the message.
                    requiredDVNs: [
                        "0xac58dB20BD970f9e856DF1732499dEf7B727BAe2",
                    ],
                    // The destination tx will wait until the configured threshold of `optionalDVNs` verify the message.
                    optionalDVNs: [
                    ],
                    // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
                    optionalDVNThreshold: 0,
                  },
                },
            }
        }
    ],
}

export default config
