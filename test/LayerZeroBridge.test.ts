import { expect, use } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";

import {
  Gateway,
  LayerZeroBridge,
  Escrow,
  MBToken,
  TestToken,
  TestTokenBurnable,
} from "../typechain-types";
import { Address } from "hardhat-deploy/types";
const ILzEndpointV2 = require("../artifacts/contracts/interfaces/ILzEndpointV2.sol/ILzEndpointV2.json");

describe("LayerZeroBridge", () => {
  let bridge: LayerZeroBridge;
  let lzEndpoint: MockContract;
  let gateway: Gateway;
  let gateway1: Gateway;
  let gateWayBurnable: Gateway;
  let bridgeToken: MBToken;
  let nativeToken: TestToken;
  let treasury: SignerWithAddress;
  let treasury1: SignerWithAddress;
  let escrow: Escrow;
  let escrowBurnable: Escrow;
  let escrowDepositor: SignerWithAddress;
  let burnableToken: TestTokenBurnable;
  let admin: SignerWithAddress,
    tokenAdder: SignerWithAddress,
    user: SignerWithAddress,
    testAddress: SignerWithAddress,
    lzSendLib: Address,
    lzReceiveLib: Address;

  const initialThreshold = ethers.utils.parseEther("100");

  const dstEid = 30106;
  const extraOption = "0x000301001101000000000000000000000000000f4240";

  before(async () => {
    [
      admin,
      tokenAdder,
      user,
      treasury,
      treasury1,
      testAddress,
      escrowDepositor,
    ] = await ethers.getSigners();
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
      lzSendLib
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

    gateWayBurnable = await Gateway.deploy(
      admin.address,
      burnableToken.address,
      bridgeToken.address
    );

    await gateWayBurnable.deployed();
  };

  const deployEscrow = async () => {
    const EscrowFactory = await ethers.getContractFactory("Escrow");
    escrow = await EscrowFactory.deploy();
    await escrow.initialize(
      gateway.address,
      treasury.address,
      initialThreshold
    );

    escrowBurnable = await EscrowFactory.deploy();
    await escrowBurnable.initialize(
      gateWayBurnable.address,
      treasury.address,
      initialThreshold
    );
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

    const BurnableTokenFactory =
      await ethers.getContractFactory("TestTokenBurnable");
    burnableToken = await BurnableTokenFactory.deploy(
      "Burnable Token",
      "BToken"
    );
    await burnableToken.deployed();

    await deployGateWay();

    await deployEscrow();

    const BridgeFactory = await ethers.getContractFactory("LayerZeroBridge");
    bridge = await BridgeFactory.connect(admin).deploy(lzEndpoint.address);
    await bridge
      .connect(admin)
      .grantRole(await bridge.TOKEN_ADDER_ROLE(), tokenAdder.address);

    await bridge
      .connect(tokenAdder)
      .addToken(
        nativeToken.address,
        bridgeToken.address,
        escrow.address,
        gateway.address,
        true,
        false
      );

    await bridge
      .connect(tokenAdder)
      .addToken(
        burnableToken.address,
        bridgeToken.address,
        escrowBurnable.address,
        gateWayBurnable.address,
        false,
        true
      );
  });

  describe("Token operations", () => {
    it("should add token successfully", async () => {
      expect((await bridge.tokens(nativeToken.address)).mbToken).to.deep.eq(
        bridgeToken.address
      );
      expect((await bridge.tokens(nativeToken.address)).gateway).to.deep.eq(
        gateway.address
      );
      expect((await bridge.tokens(nativeToken.address)).treasury).to.deep.eq(
        escrow.address
      );
    });

    it("should revert if non-tokenAdder add token", async () => {
      await expect(
        bridge
          .connect(user)
          .addToken(
            nativeToken.address,
            bridgeToken.address,
            escrow.address,
            gateway.address,
            true,
            false
          )
      ).to.revertedWithCustomError(bridge, "AccessControlUnauthorizedAccount");
    });

    it("should not remove token with invalid token address", async () => {
      expect((await bridge.tokens(nativeToken.address)).mbToken).to.deep.eq(
        bridgeToken.address
      );
      await expect(
        bridge.connect(tokenAdder).removeToken(testAddress.address)
      ).to.be.revertedWith("Invalid token");
    });

    it("non token-adder should not remove token", async () => {
      expect((await bridge.tokens(nativeToken.address)).mbToken);

      await expect(
        bridge.connect(user).removeToken(nativeToken.address)
      ).to.be.revertedWithCustomError(
        escrow,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("TokenAdder should remove token successfully", async () => {
      await bridge.connect(tokenAdder).removeToken(nativeToken.address);

      expect((await bridge.tokens(nativeToken.address)).mbToken).to.deep.eq(
        ethers.constants.AddressZero
      );
    });

    it("tokenAdder should update token successfully", async () => {
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
      expect((await bridge.tokens(nativeToken.address)).gateway).to.deep.eq(
        gateway1.address
      );
      expect((await bridge.tokens(nativeToken.address)).treasury).to.deep.eq(
        treasury1.address
      );
    });

    it("non-tokenAdder should not update token successfully", async () => {
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
      ).to.be.revertedWithCustomError(
        bridge,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should revert if native token is invalid", async () => {
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
  });

  describe("QuoteSend", () => {
    it("should quoteSend successfully", async () => {
      const amount = ethers.utils.parseUnits("1", 18);

      await bridge.quoteSend(
        nativeToken.address,
        user.address,
        dstEid,
        amount,
        amount,
        extraOption,
        false
      );
    });

    it("should not revert in large numbers quoteSend", async () => {
      const amount = ethers.utils.parseUnits("10000000000000000", 18);

      await bridge.quoteSend(
        nativeToken.address,
        user.address,
        dstEid,
        amount,
        amount,
        extraOption,
        false
      );
    });

    it("should revert quoteSend in different amount", async () => {
      const amount = ethers.utils.parseUnits("1", 18);
      const amount2 = ethers.utils.parseUnits("2", 18);

      await expect(
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

    // it("should not revert in small numbers quoteSend", async () => {
    //   const amount = ethers.utils.parseUnits("0.0000001", 18);
    //   const fee = await expect;
    //   bridge.quoteSend(
    //     nativeToken.address,
    //     user.address,
    //     dstEid,
    //     amount,
    //     amount,
    //     extraOption,
    //     false
    //   );
    // });
  });

  describe("Bridge", () => {
    it("should successfully send token", async () => {
      const escrowMintAmount = ethers.utils.parseEther("100");
      const BridgeAmount = ethers.utils.parseEther("20");
      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(0);
      expect(await nativeToken.totalSupply()).to.be.equal(0);
      //mint nativeToken for escrow
      await nativeToken.connect(admin).mint(escrow.address, escrowMintAmount);
      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(
        escrowMintAmount
      );
      expect(await nativeToken.totalSupply()).to.be.equal(escrowMintAmount);
      await escrow
        .connect(admin)
        .grantRole(escrow.DEPOSITOR_ROLE(), escrowDepositor.address);

      //Deposit to gateway
      await expect(
        escrow.connect(escrowDepositor).depositToGateway()
      ).to.be.revertedWithCustomError(
        gateway,
        "AccessControlUnauthorizedAccount"
      );

      await gateway
        .connect(admin)
        .grantRole(await gateway.DEPOSITOR_ROLE(), escrow.address);

      await escrow.connect(escrowDepositor).depositToGateway();

      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(0);
      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        escrowMintAmount
      );
      expect(await nativeToken.totalSupply()).to.be.equal(escrowMintAmount);
      expect(await gateway.deposits(escrow.address)).to.be.equal(
        escrowMintAmount
      );

      const UserNativeTokenMintAmount = ethers.utils.parseEther("50");

      expect(await nativeToken.balanceOf(user.address)).to.be.equal(0);

      //mint native token for user
      await nativeToken
        .connect(user)
        .mint(user.address, UserNativeTokenMintAmount);

      expect(await nativeToken.balanceOf(user.address)).to.be.equal(
        UserNativeTokenMintAmount
      );

      const totalSupplyBeforeBridge = await nativeToken.totalSupply();
      expect(totalSupplyBeforeBridge).to.be.equal(
        escrowMintAmount.add(UserNativeTokenMintAmount)
      );
      await nativeToken.connect(user).approve(bridge.address, BridgeAmount);

      const nativeFee = {
        lzTokenFee: BigInt(0),
        nativeFee: ethers.utils.parseUnits("0.000001", 18),
      };

      await lzEndpoint.mock.send.returns({
        guid: ethers.utils.formatBytes32String("guid"),
        nonce: 1,
        fee: {
          lzTokenFee: 0,
          nativeFee: ethers.utils.parseUnits("0.000001", 18),
        },
      });

      const MINTER_ROLE = await bridgeToken.MINTER_ROLE();
      await bridgeToken.grantRole(MINTER_ROLE, bridge.address);

      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(0);

      expect(await gateway.deposits(escrow.address)).to.be.equal(
        escrowMintAmount
      );

      expect(await gateway.deposits(user.address)).to.be.equal(0);

      expect(await nativeToken.balanceOf(user.address)).to.be.equal(
        UserNativeTokenMintAmount
      );

      await bridge
        .connect(user)
        .send(
          nativeToken.address,
          dstEid,
          BridgeAmount,
          BridgeAmount,
          extraOption,
          nativeFee,
          { value: nativeFee.nativeFee }
        );

      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(
        BridgeAmount
      );

      expect(await gateway.deposits(escrow.address)).to.be.equal(
        escrowMintAmount
      );

      expect(await gateway.deposits(user.address)).to.be.equal(0);

      expect(await nativeToken.balanceOf(user.address)).to.be.equal(
        UserNativeTokenMintAmount.sub(BridgeAmount)
      );

      //treasury ==> escrow
      expect(
        await nativeToken.balanceOf(
          (await bridge.tokens(nativeToken.address)).treasury
        )
      ).to.be.equal(BridgeAmount);

      expect(await nativeToken.totalSupply()).to.be.equal(
        totalSupplyBeforeBridge
      );
    });

    it("should successfully send token with dst fee", async () => {
      const escrowMintAmount = ethers.utils.parseEther("100");
      const BridgeAmount = ethers.utils.parseEther("20");
      //mint nativeToken for escrow
      await nativeToken.connect(admin).mint(escrow.address, escrowMintAmount);
      await escrow
        .connect(admin)
        .grantRole(escrow.DEPOSITOR_ROLE(), escrowDepositor.address);
      //Deposit to gateway
      await gateway
        .connect(admin)
        .grantRole(await gateway.DEPOSITOR_ROLE(), escrow.address);
      await escrow.connect(escrowDepositor).depositToGateway();
      const UserNativeTokenMintAmount = ethers.utils.parseEther("50");
      //mint native token for user
      await nativeToken
        .connect(user)
        .mint(user.address, UserNativeTokenMintAmount);

      const totalSupplyBeforeBridge = await nativeToken.totalSupply();

      await nativeToken.connect(user).approve(bridge.address, BridgeAmount);

      const nativeFee = {
        lzTokenFee: BigInt(0),
        nativeFee: ethers.utils.parseUnits("0.000001", 18),
      };

      await lzEndpoint.mock.send.returns({
        guid: ethers.utils.formatBytes32String("guid"),
        nonce: 1,
        fee: {
          lzTokenFee: 0,
          nativeFee: ethers.utils.parseUnits("0.000001", 18),
        },
      });

      const MINTER_ROLE = await bridgeToken.MINTER_ROLE();
      await bridgeToken.grantRole(MINTER_ROLE, bridge.address);

      expect(await bridge.dstFee(dstEid)).to.be.equal(0);

      const dseFeeAmount = ethers.utils.parseUnits("2", 18);

      await bridge.connect(admin).setDstFee(dstEid, dseFeeAmount);

      const dstFee = await bridge.dstFee(dstEid);

      expect(await bridge.dstFee(dstEid)).to.be.equals(dstFee);

      await expect(
        bridge
          .connect(user)
          .send(
            nativeToken.address,
            dstEid,
            BridgeAmount,
            BridgeAmount,
            extraOption,
            nativeFee,
            { value: nativeFee.nativeFee }
          )
      ).to.be.reverted;

      const bridgeContractNativeBalance = await ethers.provider.getBalance(
        bridge.address
      );

      const userNativeBalance = await ethers.provider.getBalance(user.address);

      const tx = await bridge
        .connect(user)
        .send(
          nativeToken.address,
          dstEid,
          BridgeAmount,
          BridgeAmount,
          extraOption,
          nativeFee,
          { value: nativeFee.nativeFee.add(dstFee) }
        );

      const receipt = await tx.wait();

      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const totalCost = nativeFee.nativeFee.add(dstFee).add(gasUsed);

      expect(await ethers.provider.getBalance(user.address)).to.be.equals(
        userNativeBalance.sub(totalCost)
      );

      expect(await ethers.provider.getBalance(bridge.address)).to.be.equals(
        dstFee.add(bridgeContractNativeBalance)
      );

      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(
        BridgeAmount
      );

      expect(await gateway.deposits(escrow.address)).to.be.equal(
        escrowMintAmount
      );

      expect(await gateway.deposits(user.address)).to.be.equal(0);

      expect(await nativeToken.balanceOf(user.address)).to.be.equal(
        UserNativeTokenMintAmount.sub(BridgeAmount)
      );

      //treasury ==> escrow
      expect(
        await nativeToken.balanceOf(
          (await bridge.tokens(nativeToken.address)).treasury
        )
      ).to.be.equal(BridgeAmount);

      expect(await nativeToken.totalSupply()).to.be.equal(
        totalSupplyBeforeBridge
      );
    });

    it("should successfully send burnable token", async () => {
      const escrowMintAmount = ethers.utils.parseEther("100");
      const BridgeAmount = ethers.utils.parseEther("20");
      expect(await burnableToken.balanceOf(escrowBurnable.address)).to.be.equal(
        0
      );

      //mint burnableToken for escrowBurnable
      expect(await burnableToken.totalSupply()).to.be.equal(0);

      await burnableToken
        .connect(admin)
        .mint(escrowBurnable.address, escrowMintAmount);

      expect(await burnableToken.totalSupply()).to.be.equal(escrowMintAmount);

      expect(await burnableToken.balanceOf(escrowBurnable.address)).to.be.equal(
        escrowMintAmount
      );

      await escrowBurnable
        .connect(admin)
        .grantRole(escrowBurnable.DEPOSITOR_ROLE(), escrowDepositor.address);

      //Deposit to gateway

      await expect(
        escrowBurnable.connect(escrowDepositor).depositToGateway()
      ).to.be.revertedWithCustomError(
        gateWayBurnable,
        "AccessControlUnauthorizedAccount"
      );

      await gateWayBurnable.grantRole(
        await gateWayBurnable.DEPOSITOR_ROLE(),
        escrowBurnable.address
      );

      await escrowBurnable.connect(escrowDepositor).depositToGateway();

      expect(await burnableToken.balanceOf(escrowBurnable.address)).to.be.equal(
        0
      );
      expect(
        await burnableToken.balanceOf(gateWayBurnable.address)
      ).to.be.equal(escrowMintAmount);
      expect(
        await gateWayBurnable.deposits(escrowBurnable.address)
      ).to.be.equal(escrowMintAmount);

      expect(await burnableToken.totalSupply()).to.be.equal(escrowMintAmount);

      const UserNativeTokenMintAmount = ethers.utils.parseEther("50");

      expect(await burnableToken.balanceOf(user.address)).to.be.equal(0);

      //mint native token for user
      await burnableToken
        .connect(user)
        .mint(user.address, UserNativeTokenMintAmount);

      const totalSupplyBeforeBridge = await burnableToken.totalSupply();
      expect(totalSupplyBeforeBridge).to.be.equal(
        escrowMintAmount.add(UserNativeTokenMintAmount)
      );

      expect(await burnableToken.balanceOf(user.address)).to.be.equal(
        UserNativeTokenMintAmount
      );

      await burnableToken.connect(user).approve(bridge.address, BridgeAmount);

      const nativeFee = {
        lzTokenFee: BigInt(0),
        nativeFee: ethers.utils.parseUnits("0.000001", 18),
      };

      await lzEndpoint.mock.send.returns({
        guid: ethers.utils.formatBytes32String("guid"),
        nonce: 1,
        fee: {
          lzTokenFee: 0,
          nativeFee: ethers.utils.parseUnits("0.000001", 18),
        },
      });

      const MINTER_ROLE = await bridgeToken.MINTER_ROLE();
      await bridgeToken.grantRole(MINTER_ROLE, bridge.address);

      expect(await burnableToken.balanceOf(escrowBurnable.address)).to.be.equal(
        0
      );

      expect(
        await gateWayBurnable.deposits(escrowBurnable.address)
      ).to.be.equal(escrowMintAmount);

      expect(await gateWayBurnable.deposits(user.address)).to.be.equal(0);

      expect(await burnableToken.balanceOf(user.address)).to.be.equal(
        UserNativeTokenMintAmount
      );

      await bridge
        .connect(user)
        .send(
          burnableToken.address,
          dstEid,
          BridgeAmount,
          BridgeAmount,
          extraOption,
          nativeFee,
          { value: nativeFee.nativeFee }
        );

      expect(await burnableToken.balanceOf(escrowBurnable.address)).to.be.equal(
        0
      );

      expect(await gateWayBurnable.deposits(user.address)).to.be.equal(0);

      expect(
        await gateWayBurnable.deposits(escrowBurnable.address)
      ).to.be.equal(escrowMintAmount);

      expect(await burnableToken.balanceOf(user.address)).to.be.equal(
        UserNativeTokenMintAmount.sub(BridgeAmount)
      );

      //treasury ==> escrow
      expect(
        await burnableToken.balanceOf(
          (await bridge.tokens(burnableToken.address)).treasury
        )
      ).to.be.equal(0);

      expect(await burnableToken.totalSupply()).to.be.equal(
        totalSupplyBeforeBridge.sub(BridgeAmount)
      );
    });
  });
});
