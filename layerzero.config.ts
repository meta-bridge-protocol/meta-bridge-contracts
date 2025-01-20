import { EndpointId } from '@layerzerolabs/lz-definitions'

import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

const baseContract: OmniPointHardhat = {
    eid: EndpointId.BASE_V2_MAINNET,
    contractName: 'MetaSYME',
}

const sonicContract: OmniPointHardhat = {
    eid: EndpointId.SONIC_V2_MAINNET,
    contractName: 'MetaSYME',
}

const config: OAppOmniGraphHardhat = {
    contracts: [
        {
            contract: baseContract,
        },
        {
            contract: sonicContract,
        },
    ],
    connections: [
        {
            from: baseContract,
            to: sonicContract,
            config: {
                // Required Send Library Address on Sepolia
                sendLibrary: "0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2",
                receiveLibraryConfig: {
                  // Required Receive Library Address on Sepolia
                  receiveLibrary: "0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf",
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
            from: sonicContract,
            to: baseContract,
            config: {
                sendLibrary: "0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7",
                receiveLibraryConfig: {
                  receiveLibrary: "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043",
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
