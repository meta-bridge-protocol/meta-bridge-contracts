import { expect, use } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import LZ_ENDPOINT_ABI from "./abi/LayerZeroEndpoint.json";
import GATEWAY_ABI from "./abi/GatewayV2.json";
import MBToken_ABI from "../artifacts/contracts/MBToken.sol/MBToken.json";
import { LayerZeroBridge, MBToken, TestToken } from "../typechain-types";

describe("LayerZeroBridge", () => {
  let bridge: LayerZeroBridge;
  let lzEndpoint: MockContract;
  let gateway: MockContract;
  let gateway1: MockContract;
  let bridgeToken: MockContract;
  let nativeToken: TestToken;
  let treasury: SignerWithAddress;
  let treasury1: SignerWithAddress;
  let admin: SignerWithAddress,
    tokenAdder: SignerWithAddress,
    user: SignerWithAddress,
    testAddress: SignerWithAddress;

  before(async () => {
    [admin, tokenAdder, user, treasury, treasury1, testAddress] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    lzEndpoint = await deployMockContract(admin, LZ_ENDPOINT_ABI);
    gateway = await deployMockContract(admin, GATEWAY_ABI);
    gateway1 = await deployMockContract(admin, GATEWAY_ABI);
    bridgeToken = await deployMockContract(admin, MBToken_ABI.abi);
    const BridgeFactory = await ethers.getContractFactory("LayerZeroBridge");
    bridge = await BridgeFactory.connect(admin).deploy(lzEndpoint.address);

    await bridge
      .connect(admin)
      .grantRole(await bridge.TOKEN_ADDER_ROLE(), tokenAdder.address);

    const TestTokenFactory = await ethers.getContractFactory("TestToken");

    await lzEndpoint.mock.setDelegate.returns();

    nativeToken = await TestTokenFactory.deploy("Native Token", "rToken");
    await nativeToken.deployed();
    await nativeToken.mint(user.address, 1000);
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

    // it("should quoteSend successfully", async () => {
    //   const amount = ethers.utils.parseUnits("1", 18);
    //   const dstEid = 10001;
    //   const extraOption = "0x000301001101000000000000000000000000000f4240";

    //   await addToken();

    //   const [nativeFee, lzTokenFee] = await bridge.quoteSend(
    //     nativeToken.address,
    //     user.address,
    //     dstEid,
    //     amount,
    //     amount,
    //     extraOption,
    //     true
    //   );

    //   expect(nativeFee).to.be.instanceOf(ethers.BigNumber);
    //   expect(lzTokenFee).to.be.instanceOf(ethers.BigNumber);

    //   expect(nativeFee.gt(0)).to.be.true;
    //   expect(lzTokenFee.gt(0)).to.be.true;
    // });

    // it("should send tokens successfully", async () => {
    //   const amount = ethers.utils.parseUnits("1", 18);
    //   const dstEid = 10001; // Destination Endpoint ID
    //   const extraOption = "0x000301001101000000000000000000000000000f4240"; // Example extra option

    //   await bridge
    //     .connect(tokenAdder)
    //     .addToken(
    //       nativeToken.address,
    //       bridgeToken.address,
    //       treasury.address,
    //       gateway.address,
    //       true,
    //       false
    //     );

    //   await nativeToken.connect(user).approve(bridge.address, amount);

    //   const nativeFee = {
    //     nativeFee: BigInt(100000000000000000),
    //     lzTokenFee: BigInt(0),
    //   };

    //   await expect(
    //     bridge
    //       .connect(user)
    //       .send(
    //         nativeToken.address,
    //         dstEid,
    //         amount,
    //         amount,
    //         extraOption,
    //         nativeFee,
    //         { value: nativeFee.nativeFee }
    //       )
    //   ).not.to.be.reverted;

    // const balanceAfter = await nativeToken.balanceOf(user.address);
    // expect(balanceAfter).to.equal(999);

    // Check if an event is emitted (if your send function emits events)
    // await expect(
    //   bridge
    //     .connect(user)
    //     .send(
    //       nativeToken.address,
    //       dstEid,
    //       amount,
    //       amount,
    //       extraOption,
    //       nativeFee,
    //       {
    //         value: nativeFee.nativeFee,
    //       }
    //     )
    // )
    //   .to.emit(bridge, "TokenSent")
    //   .withArgs(nativeToken.address, dstEid, user.address, amount);
    // });
  });
});
