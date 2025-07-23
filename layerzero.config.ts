import { EndpointId } from "@layerzerolabs/lz-definitions";

import type {
  OAppOmniGraphHardhat,
  OmniPointHardhat,
} from "@layerzerolabs/toolbox-hardhat";

const arbContract: OmniPointHardhat = {
  eid: EndpointId.ARBITRUM_V2_MAINNET,
  contractName: "MetaOApp",
};

const baseContract: OmniPointHardhat = {
  eid: EndpointId.BASE_V2_MAINNET,
  contractName: "MetaOApp",
};

const bscContract: OmniPointHardhat = {
  eid: EndpointId.BSC_V2_MAINNET,
  contractName: "MetaOApp",
};

const ftmContract: OmniPointHardhat = {
  eid: EndpointId.FANTOM_V2_MAINNET,
  contractName: "MetaOApp",
};

const sonicContract: OmniPointHardhat = {
  eid: EndpointId.SONIC_V2_MAINNET,
  contractName: "MetaOApp",
};

const arbConfig = {
  sendLibrary: "0x975bcD720be66659e3EB3C0e4F1866a3020E493A",
  receiveLibraryConfig: {
    receiveLibrary: "0x7B9E184e07a6EE1aC23eAe0fe8D6Be2f663f05e6",
    gracePeriod: BigInt(0),
  },
  // Optional Send Configuration
  // @dev Controls how the `from` chain sends messages to the `to` chain.
  sendConfig: {
    ulnConfig: {
      confirmations: BigInt(3),
      // The destination tx will wait until ALL `requiredDVNs` verify the message.
      requiredDVNs: ["0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8"],
      // The destination tx will wait until the configured threshold of `optionalDVNs` verify a message.
      optionalDVNs: [],
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
      requiredDVNs: ["0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8"],
      // The destination tx will wait until the configured threshold of `optionalDVNs` verify the message.
      optionalDVNs: [],
      // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
      optionalDVNThreshold: 0,
    },
  },
};

const baseConfig = {
  // Required Send Library Address on Fantom
  sendLibrary: "0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2",
  receiveLibraryConfig: {
    // Required Receive Library Address on Fantom
    receiveLibrary: "0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf",
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
      requiredDVNs: ["0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8"],
      // The address of the DVNs you will pay to verify a sent message on the source chain (Fantom).
      // The destination tx will wait until the configured threshold of `optionalDVNs` verify a message.
      optionalDVNs: [],
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
      requiredDVNs: ["0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8"],
      // The address of the `optionalDVNs` you expect to receive verifications from on the `from` chain ("this").
      // The destination tx will wait until the configured threshold of `optionalDVNs` verify the message.
      optionalDVNs: [],
      // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
      optionalDVNThreshold: 0,
    },
  },
};

const bscConfig = {
  // Required Send Library Address on Fantom
  sendLibrary: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
  receiveLibraryConfig: {
    // Required Receive Library Address on Fantom
    receiveLibrary: "0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1",
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
      requiredDVNs: ["0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8"],
      // The address of the DVNs you will pay to verify a sent message on the source chain (Fantom).
      // The destination tx will wait until the configured threshold of `optionalDVNs` verify a message.
      optionalDVNs: [],
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
      requiredDVNs: ["0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8"],
      // The address of the `optionalDVNs` you expect to receive verifications from on the `from` chain ("this").
      // The destination tx will wait until the configured threshold of `optionalDVNs` verify the message.
      optionalDVNs: [],
      // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
      optionalDVNThreshold: 0,
    },
  },
};

const ftmConfig = {
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
      requiredDVNs: ["0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8"],
      // The address of the DVNs you will pay to verify a sent message on the source chain (Fantom).
      // The destination tx will wait until the configured threshold of `optionalDVNs` verify a message.
      optionalDVNs: [],
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
      requiredDVNs: ["0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8"],
      // The address of the `optionalDVNs` you expect to receive verifications from on the `from` chain ("this").
      // The destination tx will wait until the configured threshold of `optionalDVNs` verify the message.
      optionalDVNs: [],
      // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
      optionalDVNThreshold: 0,
    },
  },
};

const sonicConfig = {
  // Required Send Library Address on Fantom
  sendLibrary: "0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7",
  receiveLibraryConfig: {
    // Required Receive Library Address on Fantom
    receiveLibrary: "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043",
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
      requiredDVNs: ["0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8"],
      // The address of the DVNs you will pay to verify a sent message on the source chain (Fantom).
      // The destination tx will wait until the configured threshold of `optionalDVNs` verify a message.
      optionalDVNs: [],
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
      requiredDVNs: ["0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8"],
      // The address of the `optionalDVNs` you expect to receive verifications from on the `from` chain ("this").
      // The destination tx will wait until the configured threshold of `optionalDVNs` verify the message.
      optionalDVNs: [],
      // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
      optionalDVNThreshold: 0,
    },
  },
};

const config: OAppOmniGraphHardhat = {
  contracts: [
    {
      contract: arbContract,
    },
    {
      contract: baseContract,
    },
    {
      contract: bscContract,
    },
    {
      contract: ftmContract,
    },
    {
      contract: sonicContract,
    },
  ],
  connections: [
    {
      from: arbContract,
      to: baseContract,
      config: arbConfig,
    },
    {
      from: arbContract,
      to: bscContract,
      config: arbConfig,
    },
    {
      from: arbContract,
      to: ftmContract,
      config: arbConfig,
    },
    {
      from: arbContract,
      to: sonicContract,
      config: arbConfig,
    },
    {
      from: baseContract,
      to: arbContract,
      config: baseConfig,
    },
    {
      from: baseContract,
      to: bscContract,
      config: baseConfig,
    },
    {
      from: baseContract,
      to: ftmContract,
      config: baseConfig,
    },
    {
      from: baseContract,
      to: sonicContract,
      config: baseConfig,
    },
    {
      from: bscContract,
      to: arbContract,
      config: bscConfig,
    },
    {
      from: bscContract,
      to: baseContract,
      config: bscConfig,
    },
    {
      from: bscContract,
      to: ftmContract,
      config: bscConfig,
    },
    {
      from: bscContract,
      to: sonicContract,
      config: bscConfig,
    },
    {
      from: ftmContract,
      to: arbContract,
      config: ftmConfig,
    },
    {
      from: ftmContract,
      to: baseContract,
      config: ftmConfig,
    },
    {
      from: ftmContract,
      to: bscContract,
      config: ftmConfig,
    },
    {
      from: ftmContract,
      to: sonicContract,
      config: ftmConfig,
    },
    {
      from: sonicContract,
      to: arbContract,
      config: sonicConfig,
    },
    {
      from: sonicContract,
      to: baseContract,
      config: sonicConfig,
    },
    {
      from: sonicContract,
      to: bscContract,
      config: sonicConfig,
    },
    {
      from: sonicContract,
      to: ftmContract,
      config: sonicConfig,
    },
  ],
};

export default config;
