import { expect, use } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
// import LZ_ENDPOINT_ABI from "./abi/LayerZeroEndpoint.json";
import GATEWAY_ABI from "./abi/GatewayV2.json";
// import MBToken_ABI from "../artifacts/contracts/MBToken.sol/MBToken.json";
import {
  Gateway,
  LayerZeroBridge,
  MBToken,
  TestToken,
} from "../typechain-types";
import { Address } from "hardhat-deploy/types";
const ILzEndpointV2 = require("../artifacts/contracts/interfaces/ILzEndpointV2.sol/ILzEndpointV2.json");
const ONE = ethers.utils.parseUnits("1", 18);
describe("LayerZeroBridge", () => {
  let bridge: LayerZeroBridge;
  let lzEndpoint: MockContract;
  let gateway: Gateway;
  let gateway1: Gateway;
  let bridgeToken: MBToken;
  let nativeToken: TestToken;
  let treasury: SignerWithAddress;
  let treasury1: SignerWithAddress;
  let admin: SignerWithAddress,
    tokenAdder: SignerWithAddress,
    user: SignerWithAddress,
    testAddress: SignerWithAddress,
    lzSendLib: Address,
    lzReceiveLib: Address;
  before(async () => {
    [admin, tokenAdder, user, treasury, treasury1, testAddress] =
      await ethers.getSigners();
  });

  const deployBridgeToken = async () => {
    const requiredDVNs = [admin.address];
    lzSendLib = admin.address;
    lzReceiveLib = admin.address;
    const mbTokenFactory = await ethers.getContractFactory("MBToken");
    bridgeToken = await mbTokenFactory.deploy(
      "MyToken",
      "MTK",
      lzEndpoint.address,
      lzSendLib,
      lzReceiveLib,
      requiredDVNs,
      admin.address
    );
  };

  const deployGateWay = async () => {
    const Gateway = await ethers.getContractFactory("Gateway");
    gateway = await Gateway.deploy(
      admin.address,
      nativeToken.address,
      bridgeToken.address
    );
    await gateway.deployed();

    await bridgeToken.setPeer(
      30106,
      "0x000000000000000000000000650a795b3b728df29c252ef49cfd5884b68d8644"
    );

    await bridgeToken.setGateway(gateway.address);

    gateway1 = await Gateway.deploy(
      admin.address,
      nativeToken.address,
      bridgeToken.address
    );
    await gateway1.deployed();
  };

  beforeEach(async () => {
    lzEndpoint = await deployMockContract(admin, ILzEndpointV2.abi);
    await lzEndpoint.mock.setDelegate.returns();
    await lzEndpoint.mock.setConfig.returns();
    await lzEndpoint.mock.eid.returns(30106);
    await lzEndpoint.mock.quote.returns([
      ethers.BigNumber.from(0),
      ethers.utils.parseUnits("0.000001", 18),
    ]);

    await deployBridgeToken();

    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    nativeToken = await TestTokenFactory.deploy("Native Token", "rToken");
    await nativeToken.deployed();
    await nativeToken.mint(user.address, 1000);

    await deployGateWay();

    const BridgeFactory = await ethers.getContractFactory("LayerZeroBridge");
    bridge = await BridgeFactory.connect(admin).deploy(lzEndpoint.address);
    await bridge
      .connect(admin)
      .grantRole(await bridge.TOKEN_ADDER_ROLE(), tokenAdder.address);
  });

  const addToken = async () => {
    await bridge
      .connect(tokenAdder)
      .addToken(
        nativeToken.address,
        bridgeToken.address,
        treasury.address,
        gateway.address,
        true,
        false
      );
  };

  describe("Token operations", () => {
    it("should add token successfully", async () => {
      await addToken();
      expect((await bridge.tokens(nativeToken.address)).mbToken).to.deep.eq(
        bridgeToken.address
      );
    });

    it("should remove token successfully", async () => {
      await addToken();

      expect((await bridge.tokens(nativeToken.address)).mbToken).to.deep.eq(
        bridgeToken.address
      );

      await expect(
        bridge.connect(tokenAdder).removeToken(testAddress.address)
      ).to.be.revertedWith("Invalid token");

      await expect(
        bridge.connect(user.address).removeToken(nativeToken.address)
      ).to.be.rejected;

      await expect(bridge.connect(tokenAdder).removeToken(nativeToken.address))
        .not.to.be.reverted;

      expect((await bridge.tokens(nativeToken.address)).mbToken).to.deep.eq(
        ethers.constants.AddressZero
      );
    });

    it("should update token successfully", async () => {
      await addToken();

      expect((await bridge.tokens(nativeToken.address)).mbToken).to.deep.eq(
        bridgeToken.address
      );

      await bridge
        .connect(tokenAdder)
        .updateToken(
          nativeToken.address,
          bridgeToken.address,
          treasury1.address,
          gateway1.address,
          true,
          false
        );

      expect((await bridge.tokens(nativeToken.address)).mbToken).to.deep.eq(
        bridgeToken.address
      );

      await expect(
        bridge
          .connect(user)
          .updateToken(
            nativeToken.address,
            bridgeToken.address,
            treasury1.address,
            gateway1.address,
            true,
            false
          )
      ).to.be.reverted;

      await expect(
        bridge
          .connect(tokenAdder)
          .updateToken(
            testAddress.address,
            bridgeToken.address,
            treasury1.address,
            gateway1.address,
            true,
            false
          )
      ).to.be.revertedWith("Invalid token");
    });

    it("should quoteSend successfully", async () => {
      const amount = ethers.utils.parseUnits("1", 18);
      const dstEid = 30106;
      const extraOption = "0x000301001101000000000000000000000000000f4240";

      await addToken();

      const fee = await expect(
        bridge.quoteSend(
          nativeToken.address,
          user.address,
          dstEid,
          amount,
          amount,
          extraOption,
          false
        )
      ).not.to.be.reverted;
    });

    // it("should not revert in small numbers quoteSend", async () => {
    //   const amount = ethers.utils.parseUnits("0.0000001", 18);

    //   const dstEid = 30106;
    //   const extraOption = "0x000301001101000000000000000000000000000f4240";

    //   await addToken();

    //   const fee = await expect(
    //     bridge.quoteSend(
    //       nativeToken.address,
    //       user.address,
    //       dstEid,
    //       amount,
    //       amount,
    //       extraOption,
    //       false
    //     )
    //   ).not.to.be.reverted;
    // });

    it("should not revert in large numbers quoteSend", async () => {
      const amount = ethers.utils.parseUnits("10000000000000000", 18);

      const dstEid = 30106;
      const extraOption = "0x000301001101000000000000000000000000000f4240";

      await addToken();

      const fee = await expect(
        bridge.quoteSend(
          nativeToken.address,
          user.address,
          dstEid,
          amount,
          amount,
          extraOption,
          false
        )
      ).not.to.be.reverted;
    });

    it("should revert quoteSend in different amount", async () => {
      const amount = ethers.utils.parseUnits("1", 18);
      const amount2 = ethers.utils.parseUnits("2", 18);
      const dstEid = 30106;
      const extraOption = "0x000301001101000000000000000000000000000f4240";

      await addToken();

      const fee = await expect(
        bridge.quoteSend(
          nativeToken.address,
          user.address,
          dstEid,
          amount,
          amount2,
          extraOption,
          false
        )
      ).to.be.reverted;
    });

    it("should send tokens successfully", async () => {
      const amount = ethers.utils.parseUnits("1", 18);
      const dstEid = 30106;
      const extraOption = "0x000301001101000000000000000000000000000f4240";

      await addToken();

      await nativeToken.mint(user.address, ethers.utils.parseUnits("5", 18));
      await nativeToken.connect(user).approve(bridge.address, amount);
      const MINTER_ROLE = await bridgeToken.MINTER_ROLE();

      const nativeFee = {
        lzTokenFee: BigInt(0),
        nativeFee: ethers.utils.parseUnits("0.000001", 18),
      };

      const messagingParams = {
        dstEid: 30106,
        receiver: ethers.utils.hexZeroPad(user.address, 32),
        message: ethers.utils.hexlify(ethers.utils.toUtf8Bytes("YourMessage")),
        options: "0x000301001101000000000000000000000000000f4240",
        payInLzToken: false,
      };

      await lzEndpoint.mock.send.returns({
        guid: ethers.utils.formatBytes32String("guid"),
        nonce: 1,
        fee: {
          lzTokenFee: 0,
          nativeFee: ethers.utils.parseUnits("0.000001", 18),
        },
      });

      await bridgeToken.grantRole(MINTER_ROLE, bridge.address);

      await bridge
        .connect(user)
        .send(
          nativeToken.address,
          dstEid,
          amount,
          amount,
          extraOption,
          nativeFee,
          { value: nativeFee.nativeFee }
        );
    });
  });
});
