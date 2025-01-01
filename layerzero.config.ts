import { EndpointId } from '@layerzerolabs/lz-definitions'

import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

const bsctestContract: OmniPointHardhat = {
    eid: EndpointId.BSC_V2_TESTNET,
    contractName: 'MetaLUV',
}

const fujiContract: OmniPointHardhat = {
    eid: EndpointId.AVALANCHE_V2_TESTNET,
    contractName: 'MetaLUV',
}

const polygonContract: OmniPointHardhat = {
  eid: EndpointId.POLYGON_V2_MAINNET,
  contractName: 'MetaDEUS',
}

const fantomContract: OmniPointHardhat = {
  eid: EndpointId.FANTOM_V2_MAINNET,
  contractName: 'MetaDEUS',
}

const config: OAppOmniGraphHardhat = {
    contracts: [
        {
            contract: fantomContract,
        },
        {
            contract: polygonContract,
        },
    ],
    connections: [
        {
            from: fantomContract,
            to: polygonContract,
            config: {
                // Required Send Library Address on Sepolia
                sendLibrary: "0xC17BaBeF02a937093363220b0FB57De04A535D5E",
                receiveLibraryConfig: {
                  // Required Receive Library Address on Sepolia
                  receiveLibrary: "0xe1Dd69A2D08dF4eA6a30a91cC061ac70F98aAbe3",
                  // Optional Grace Period for Switching Receive Library Address on Sepolia
                  gracePeriod: BigInt(0),
                },
                // Optional Send Configuration
                // @dev Controls how the `from` chain sends messages to the `to` chain.
                sendConfig: {
                  ulnConfig: {
                    // The number of block confirmations to wait on Sepolia before emitting the message from the source chain (Sepolia).
                    confirmations: BigInt(3),
                    // The address of the DVNs you will pay to verify a sent message on the source chain (Sepolia).
                    // The destination tx will wait until ALL `requiredDVNs` verify the message.
                    requiredDVNs: [
                        "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
                    ],
                    // The address of the DVNs you will pay to verify a sent message on the source chain (Sepolia).
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
                    // The number of block confirmations to expect from the `to` chain (Sepolia).
                    confirmations: BigInt(3),
                    // The address of the DVNs your `receiveConfig` expects to receive verifications from on the `from` chain (Sepolia).
                    // The `from` chain's OApp will wait until the configured threshold of `requiredDVNs` verify the message.
                    requiredDVNs: [
                        "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
                    ],
                    // The address of the `optionalDVNs` you expect to receive verifications from on the `from` chain (Sepolia).
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
            from: polygonContract,
            to: fantomContract,
            config: {
                sendLibrary: "0x6c26c61a97006888ea9E4FA36584c7df57Cd9dA3",
                receiveLibraryConfig: {
                  receiveLibrary: "0x1322871e4ab09Bc7f5717189434f97bBD9546e95",
                  gracePeriod: BigInt(0),
                },
                // Optional Send Configuration
                // @dev Controls how the `from` chain sends messages to the `to` chain.
                sendConfig: {
                  ulnConfig: {
                    confirmations: BigInt(3),
                    // The destination tx will wait until ALL `requiredDVNs` verify the message.
                    requiredDVNs: [
                        "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
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
                        "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
                    ],
                    // The destination tx will wait until the configured threshold of `optionalDVNs` verify the message.
                    optionalDVNs: [
                    ],
                    // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
                    optionalDVNThreshold: 0,
                  },
                },
            }
        },
    ],
}

export default config
