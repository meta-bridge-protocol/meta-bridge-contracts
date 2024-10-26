import { expect, use } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import { describe, it, beforeEach } from "mocha";
import { Address } from "hardhat-deploy/types";
import { MBToken, TestToken, Gateway } from "../typechain-types";
const ILzEndpointV2 = require("../artifacts/contracts/interfaces/ILzEndpointV2.sol/ILzEndpointV2.json");

describe("Gateway", function () {
  let gateway: Gateway;
  let mbToken: MBToken;
  let nativeToken: TestToken;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let layerZeroEndpoint: MockContract;
  let lzSendLib: Address;
  let lzReceiveLib: Address;
  beforeEach(async function () {
    // Deploy mock contracts for MBToken and NativeToken
    [owner, user] = await ethers.getSigners();

    layerZeroEndpoint = await deployMockContract(owner, ILzEndpointV2.abi);

    await layerZeroEndpoint.mock.setDelegate.returns();

    lzSendLib = owner.address;
    lzReceiveLib = owner.address;
    const requiredDVNs = [owner.address];

    await layerZeroEndpoint.mock.setConfig.returns();

    await layerZeroEndpoint.mock.eid.returns(1);

    const mbTokenFactory = await ethers.getContractFactory("MBToken");

    mbToken = await mbTokenFactory.deploy(
      "MyToken",
      "MTK",
      layerZeroEndpoint.address,
      lzSendLib,
      lzReceiveLib,
      requiredDVNs,
      owner.address
    );

    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    nativeToken = await TestTokenFactory.deploy("Native Token", "rToken");
    await nativeToken.deployed();

    // Deploy the Gateway contract
    const Gateway = await ethers.getContractFactory("Gateway");
    gateway = await Gateway.deploy(
      owner.address,
      nativeToken.address,
      mbToken.address
    );
    await gateway.deployed();
  });

  describe("Deposit", function () {
    it("should allow users to deposit native tokens", async function () {
      const depositAmount = ethers.utils.parseUnits("10", 18);
      await nativeToken.connect(user).mint(user.address, depositAmount);
      await nativeToken.connect(user).approve(gateway.address, depositAmount);

      await expect(gateway.connect(user).deposit(depositAmount)).not.to.be
        .reverted;

      expect(await gateway.deposits(user.address)).to.equal(depositAmount);

      const gatewayBalance = await nativeToken.balanceOf(gateway.address);
      await expect(gatewayBalance).to.equal(depositAmount);

      const receivedAmount = await nativeToken.balanceOf(gateway.address);
      await expect(receivedAmount).to.equal(depositAmount);
    });

    it("should not allow users to deposit native tokens if not approved", async function () {
      const depositAmount = ethers.utils.parseUnits("10", 18);
      nativeToken.connect(user).mint(user.address, depositAmount);
      await expect(gateway.connect(user).deposit(depositAmount)).to.be.reverted;
    });

    it("should not allow users to deposit native tokens with InsufficientAllowance", async function () {
      const depositAmount = ethers.utils.parseUnits("10", 18);
      await nativeToken.connect(user).approve(gateway.address, depositAmount);
      await expect(gateway.connect(user).deposit(depositAmount)).to.be.reverted;
    });

    it("should revert if deposit amount is 0", async function () {
      await expect(gateway.deposit(0)).to.be.revertedWith(
        "Gateway: TOTAL_DEPOSIT_MUST_BE_GREATER_THAN_0"
      );
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      const depositAmount = ethers.utils.parseUnits("10", 18);
      await nativeToken.connect(user).mint(user.address, depositAmount);
      await nativeToken.connect(user).approve(gateway.address, depositAmount);
    });

    it("should allow users to withdraw native and mb tokens", async function () {
      const withdrawNativeAmount = ethers.utils.parseUnits("5", 18);
      const withdrawMBTokenAmount = ethers.utils.parseUnits("0");
      const depositAmount = ethers.utils.parseUnits("10", 18);
      await gateway.connect(user).deposit(depositAmount);
      expect(await gateway.deposits(user.address)).to.equal(depositAmount);
      const gatewayBalance = await nativeToken.balanceOf(gateway.address);
      await expect(gatewayBalance).to.equal(depositAmount);

      await expect(
        gateway
          .connect(user)
          .withdraw(withdrawNativeAmount, withdrawMBTokenAmount)
      ).not.to.be.reverted;

      expect(await gateway.deposits(user.address)).to.equal(
        ethers.utils.parseUnits("5", 18)
      );

      expect(await nativeToken.balanceOf(user.address)).to.equal(
        ethers.utils.parseUnits("5", 18)
      );

      expect(await nativeToken.balanceOf(gateway.address)).to.equal(
        ethers.utils.parseUnits("5", 18)
      );
    });

    it("should revert if total withdrawal amount is 0", async function () {
      await expect(gateway.withdraw(0, 0)).to.be.revertedWith(
        "Gateway: TOTAL_WITHDRAWAL_MUST_BE_GREATER_THAN_0"
      );
    });

    it("should revert if user has insufficient balance", async function () {
      await expect(
        gateway.withdraw(ethers.utils.parseUnits("20", 18), 0)
      ).to.be.revertedWith("Gateway: INSUFFICIENT_USER_BALANCE");
    });
  });

  describe("Swaps", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await mbToken.MINTER_ROLE();
      await mbToken.connect(owner).grantRole(MINTER_ROLE, owner.address);
      await mbToken.connect(owner).setGateway(gateway.address);
      const depositAmount = ethers.utils.parseUnits("10", 18);
      await nativeToken.connect(user).mint(user.address, depositAmount);
      await nativeToken.connect(user).approve(gateway.address, depositAmount);
      await gateway.connect(user).deposit(depositAmount);
      expect(await gateway.deposits(user.address)).to.equal(depositAmount);
    });

    it("should allow users to swap MBToken tokens to native", async function () {
      const mintAmount = ethers.utils.parseUnits("10", 18);
      const swapAmount = ethers.utils.parseUnits("4", 18);
      await mbToken.mint(user.address, mintAmount);
      const initMbTokenBalance = await mbToken.balanceOf(user.address);
      await mbToken.connect(user).approve(gateway.address, swapAmount);
      await gateway.connect(user).swapToNative(swapAmount);

      expect(await mbToken.connect(user).balanceOf(user.address)).to.be.eq(
        initMbTokenBalance.sub(swapAmount)
      );
      expect(await mbToken.balanceOf(gateway.address)).to.be.eq(swapAmount);

      expect(await nativeToken.connect(user).balanceOf(user.address)).to.be.eq(
        swapAmount
      );

      expect(await nativeToken.balanceOf(gateway.address)).to.be.eq(
        initMbTokenBalance.sub(swapAmount)
      );
    });

    it("should allow users to swap native tokens to MBToken", async function () {
      const swapAmount = ethers.utils.parseUnits("4", 18);
      const mintAmount = ethers.utils.parseUnits("10", 18);
      const initGateWayBalance = await nativeToken.balanceOf(gateway.address);
      await mbToken.mint(gateway.address, mintAmount);
      await nativeToken.mint(user.address, mintAmount);
      await nativeToken.connect(user).approve(gateway.address, swapAmount);
      await gateway.connect(user).swapToMBToken(swapAmount);

      expect(await mbToken.connect(user).balanceOf(user.address)).to.be.eq(
        swapAmount
      );

      expect(await mbToken.balanceOf(gateway.address)).to.be.eq(
        mintAmount.sub(swapAmount)
      );

      expect(await nativeToken.connect(user).balanceOf(user.address)).to.be.eq(
        mintAmount.sub(swapAmount)
      );

      expect(await nativeToken.balanceOf(gateway.address)).to.be.eq(
        initGateWayBalance.add(swapAmount)
      );
    });

    it("should revert if swap amount is 0", async function () {
      await expect(gateway.swapToNative(0)).to.be.revertedWith(
        "Gateway: AMOUNT_MUST_BE_GREATER_THAN_0"
      );
    });

    it("should revert if swap amount is 0", async function () {
      await expect(gateway.swapToMBToken(0)).to.be.revertedWith(
        "Gateway: AMOUNT_MUST_BE_GREATER_THAN_0"
      );
    });

    it("should revert if recipient address is zero", async function () {
      await expect(
        gateway.swapToNativeTo(
          ethers.utils.parseUnits("5", 18),
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("Gateway: RECIPIENT_ADDRESS_MUST_BE_NON-ZERO");
    });
  });

  describe("Simultaneous Actions", function () {
    it("should handle simultaneous deposits and withdrawals", async function () {
      const depositAmount = ethers.utils.parseUnits("10", 18);
      const withdrawAmount = ethers.utils.parseUnits("5", 18);
      await nativeToken.connect(user).mint(user.address, depositAmount);
      await nativeToken.connect(user).approve(gateway.address, depositAmount);
      await gateway.connect(user).deposit(depositAmount);
      await gateway.connect(user).withdraw(withdrawAmount, 0);
      expect(await gateway.deposits(user.address)).to.equal(
        depositAmount.sub(withdrawAmount)
      );
    });
  });

  describe("Pausable functionality", function () {
    it("should not allow a user to pause the contract", async function () {
      await expect(gateway.pause()).to.be.reverted;
    });

    it("should allow the pauser to pause the contract", async function () {
      const PAUSER_ROLE = await gateway.PAUSER_ROLE();
      await gateway.grantRole(PAUSER_ROLE, owner.address);
      await gateway.pause();

      expect(await gateway.paused()).to.equal(true);
    });

    it("should allow the pauser to unpause the contract", async function () {
      const PAUSER_ROLE = await gateway.PAUSER_ROLE();
      await gateway.grantRole(PAUSER_ROLE, owner.address);
      await gateway.pause();
      await gateway.unpause();

      expect(await gateway.paused()).to.equal(false);
    });

    it("should revert when trying to perform an action while paused", async function () {
      const PAUSER_ROLE = await gateway.PAUSER_ROLE();
      const withdrawNativeAmount = ethers.utils.parseUnits("5", 18);
      const withdrawMBTokenAmount = ethers.utils.parseUnits("5", 18);
      await gateway.grantRole(PAUSER_ROLE, owner.address);
      await gateway.pause();

      await expect(gateway.deposit(ethers.utils.parseUnits("10", 18))).to.be
        .reverted;

      await expect(
        gateway.withdraw(withdrawNativeAmount, withdrawMBTokenAmount)
      ).to.be.reverted;
    });
  });
});
