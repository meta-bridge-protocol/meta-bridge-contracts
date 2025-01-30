import { EndpointId } from '@layerzerolabs/lz-definitions'

import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

const polygonContract: OmniPointHardhat = {
  eid: EndpointId.POLYGON_V2_MAINNET,
  contractName: 'MetaDEUS',
}

const fantomContract: OmniPointHardhat = {
  eid: EndpointId.FANTOM_V2_MAINNET,
  contractName: 'MetaDEUS',
}

const sonicContract: OmniPointHardhat = {
  eid: EndpointId.SONIC_V2_MAINNET,
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
        {
            contract: sonicContract,
        },
    ],
    connections: [
        {
            from: fantomContract,
            to: polygonContract,
            config: {
                // Required Send Library Address on Fantom
                sendLibrary: "0xC17BaBeF02a937093363220b0FB57De04A535D5E",
                receiveLibraryConfig: {
                  // Required Receive Library Address on Fantom
                  receiveLibrary: "0xe1Dd69A2D08dF4eA6a30a91cC061ac70F98aAbe3",
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
                        "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
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
                        "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
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
        {
          from: fantomContract,
          to: sonicContract,
          config: {
              sendLibrary: "0xC17BaBeF02a937093363220b0FB57De04A535D5E",
              receiveLibraryConfig: {
                receiveLibrary: "0xe1Dd69A2D08dF4eA6a30a91cC061ac70F98aAbe3",
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
      {
        from: sonicContract,
        to: fantomContract,
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
