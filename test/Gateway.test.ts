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
  let user1: SignerWithAddress;
  let depositor: SignerWithAddress;
  let pauser: SignerWithAddress;
  let unPauser: SignerWithAddress;
  let layerZeroEndpoint: MockContract;
  let lzSendLib: Address;
  let lzReceiveLib: Address;
  beforeEach(async function () {
    // Deploy mock contracts for MBToken and NativeToken
    [owner, user, user1, pauser, unPauser, depositor] =
      await ethers.getSigners();

    layerZeroEndpoint = await deployMockContract(owner, ILzEndpointV2.abi);

    await layerZeroEndpoint.mock.setDelegate.returns();

    lzSendLib = owner.address;
    lzReceiveLib = owner.address;

    await layerZeroEndpoint.mock.setConfig.returns();

    await layerZeroEndpoint.mock.eid.returns(1);

    const mbTokenFactory = await ethers.getContractFactory("MBToken");

    mbToken = await mbTokenFactory.deploy(
      "MyToken",
      "MTK",
      layerZeroEndpoint.address,
      lzSendLib
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

    await expect(
      gateway
        .connect(user)
        .grantRole(await gateway.DEPOSITOR_ROLE(), depositor.address)
    ).to.be.revertedWithCustomError(
      gateway,
      "AccessControlUnauthorizedAccount"
    );

    await gateway
      .connect(owner)
      .grantRole(await gateway.DEPOSITOR_ROLE(), depositor.address);
  });

  describe("Deposit", function () {
    it("should allow Depositor to deposit native tokens", async function () {
      const depositAmount = ethers.utils.parseUnits("10", 18);

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(0);

      await nativeToken
        .connect(depositor)
        .mint(depositor.address, depositAmount);

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        depositAmount
      );

      expect(await nativeToken.totalSupply()).to.be.equal(depositAmount);

      //approve
      await nativeToken
        .connect(depositor)
        .approve(gateway.address, depositAmount);

      //check depositor deposit amount in gateway before deposit
      expect(await gateway.deposits(depositor.address)).to.be.equal(0);

      //deposit nativeToken
      await expect(
        gateway.connect(user).deposit(depositAmount)
      ).revertedWithCustomError(gateway, "AccessControlUnauthorizedAccount");

      await gateway.connect(depositor).deposit(depositAmount);

      //check depositor nativeToken Balance after deposit
      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(0);

      //check depositor deposit amount in gateway after deposit
      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount
      );

      //check gateway nativeToken balance after deposit
      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount
      );
    });

    it("should correctly increase depositor deposit amount", async function () {
      const depositAmount = ethers.utils.parseUnits("10", 18);
      const mintAmount = ethers.utils.parseUnits("20", 18);
      const approveAmount = ethers.utils.parseUnits("20", 18);
      //check depositor nativeToken balance before mint
      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(0);

      //mint nativeToken for depositor
      await nativeToken.connect(depositor).mint(depositor.address, mintAmount);

      //check depositor nativeToken balance and total supply after mint.
      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount
      );
      expect(await nativeToken.totalSupply()).to.be.equal(mintAmount);

      //approve
      await nativeToken
        .connect(depositor)
        .approve(gateway.address, approveAmount);

      //check depositor deposit amount in gateway before deposit

      await expect(
        gateway.connect(user).deposit(depositAmount)
      ).to.be.revertedWithCustomError(
        gateway,
        "AccessControlUnauthorizedAccount"
      );

      gateway.grantRole(await gateway.DEPOSITOR_ROLE(), depositor.address);

      //deposit nativeToken
      await gateway.connect(depositor).deposit(depositAmount);

      //check depositor nativeToken Balance after deposit
      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount.sub(depositAmount)
      );

      //check depositor deposit amount in gateway after deposit
      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount
      );

      //check gateway nativeToken balance after deposit
      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount
      );

      await gateway.connect(depositor).deposit(depositAmount);

      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount.add(depositAmount)
      );

      //check gateway nativeToken balance after deposit
      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount.add(depositAmount)
      );
    });

    it("should not allow depositor to deposit native tokens if not approved", async function () {
      const depositAmount = ethers.utils.parseUnits("10", 18);

      expect(
        await nativeToken.connect(depositor).balanceOf(depositor.address)
      ).equal(0);
      nativeToken.connect(depositor).mint(depositor.address, depositAmount);
      expect(
        await nativeToken.connect(depositor).balanceOf(depositor.address)
      ).equal(depositAmount);
      expect(
        await nativeToken.connect(depositor).balanceOf(gateway.address)
      ).equal(0);

      await expect(
        gateway.connect(depositor).deposit(depositAmount)
      ).to.be.revertedWithCustomError(
        nativeToken,
        "ERC20InsufficientAllowance"
      );

      expect(
        await nativeToken.connect(depositor).balanceOf(depositor.address)
      ).to.be.equal(depositAmount);

      expect(
        await gateway.connect(depositor).deposits(depositor.address)
      ).to.be.equal(0);

      expect(
        await nativeToken.connect(depositor).balanceOf(gateway.address)
      ).to.be.equal(0);
    });

    it("should not allow depositor to deposit native tokens with Insufficient balance", async function () {
      const depositAmount = ethers.utils.parseUnits("10", 18);
      await nativeToken
        .connect(depositor)
        .approve(gateway.address, depositAmount);
      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(0);

      await expect(
        gateway.connect(depositor).deposit(depositAmount)
      ).to.be.revertedWithCustomError(nativeToken, "ERC20InsufficientBalance");

      expect(
        await gateway.connect(depositor).deposits(depositor.address)
      ).to.be.equal(0);
    });

    it("should revert if deposit amount is 0", async function () {
      await expect(gateway.connect(depositor).deposit(0)).to.be.revertedWith(
        "Gateway: TOTAL_DEPOSIT_MUST_BE_GREATER_THAN_0"
      );
    });
  });

  describe("Withdraw", function () {
    const depositAmount = ethers.utils.parseUnits("10", 18);
    beforeEach(async function () {
      const MINTER_ROLE = await mbToken.MINTER_ROLE();
      await nativeToken
        .connect(depositor)
        .mint(depositor.address, depositAmount);
      await nativeToken
        .connect(depositor)
        .approve(gateway.address, depositAmount);
      await gateway
        .connect(depositor)
        .connect(depositor)
        .deposit(depositAmount);
      await mbToken.connect(owner).grantRole(MINTER_ROLE, owner.address);
      await mbToken.connect(owner).setGateway(gateway.address);
    });

    it("should allow depositor to withdraw native tokens", async function () {
      const withdrawNativeAmount = ethers.utils.parseUnits("5", 18);
      const withdrawMBTokenAmount = ethers.utils.parseUnits("0");

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal("0");
      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount
      );
      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount
      );

      await gateway
        .connect(depositor)
        .withdraw(withdrawNativeAmount, withdrawMBTokenAmount);

      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount.sub(withdrawNativeAmount)
      );

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        withdrawNativeAmount
      );

      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount.sub(withdrawNativeAmount)
      );
    });

    it("should allow depositor to withdraw mb tokens", async function () {
      const swapAmount = ethers.utils.parseUnits("4", 18);
      const mintAmount = ethers.utils.parseUnits("10", 18);
      const mbTokenWithdrawAmount = ethers.utils.parseUnits("2", 18);
      const nativeTokenWithdrawAmount = ethers.utils.parseUnits("3", 18);

      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount
      );

      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(0);

      await mbToken.connect(owner).mint(gateway.address, mintAmount);
      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(mintAmount);

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(0);

      await nativeToken.connect(depositor).mint(depositor.address, mintAmount);
      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount
      );

      await nativeToken.connect(depositor).approve(gateway.address, swapAmount);

      //Swap
      await gateway.connect(depositor).swapToMBToken(swapAmount);

      expect(await mbToken.balanceOf(depositor.address)).to.be.equal(
        swapAmount
      );

      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(
        mintAmount.sub(swapAmount)
      );

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount.sub(swapAmount)
      );

      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount.add(swapAmount)
      );

      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount
      );

      //Withdraw
      await gateway
        .connect(depositor)
        .withdraw(nativeTokenWithdrawAmount, mbTokenWithdrawAmount);

      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount.add(swapAmount).sub(nativeTokenWithdrawAmount)
      );

      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(
        mintAmount.sub(swapAmount).sub(mbTokenWithdrawAmount)
      );

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount.sub(swapAmount).add(nativeTokenWithdrawAmount)
      );

      expect(await mbToken.balanceOf(depositor.address)).to.be.equal(
        swapAmount.add(mbTokenWithdrawAmount)
      );

      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount.sub(nativeTokenWithdrawAmount).sub(mbTokenWithdrawAmount)
      );
    });

    it("should revert if total withdrawal amount is 0", async function () {
      await expect(
        gateway.connect(depositor).withdraw(0, 0)
      ).to.be.revertedWith("Gateway: TOTAL_WITHDRAWAL_MUST_BE_GREATER_THAN_0");
    });

    it("should revert if user has insufficient balance", async function () {
      await expect(
        gateway
          .connect(depositor)
          .withdraw(ethers.utils.parseUnits("20", 18), 0)
      ).to.be.revertedWith("Gateway: INSUFFICIENT_USER_BALANCE");
    });
  });

  describe("Swaps", function () {
    const depositAmount = ethers.utils.parseUnits("10", 18);
    beforeEach(async function () {
      const MINTER_ROLE = await mbToken.MINTER_ROLE();
      await mbToken.connect(owner).grantRole(MINTER_ROLE, owner.address);
      await mbToken.connect(owner).setGateway(gateway.address);
      await nativeToken
        .connect(depositor)
        .mint(depositor.address, depositAmount);
      await nativeToken
        .connect(depositor)
        .approve(gateway.address, depositAmount);
      await gateway.connect(depositor).deposit(depositAmount);
    });

    it("should allow users to swap MBToken tokens to native", async function () {
      const mintAmount = ethers.utils.parseUnits("10", 18);
      const swapAmount = ethers.utils.parseUnits("4", 18);

      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount
      );
      expect(await mbToken.balanceOf(depositor.address)).to.be.equal(0);

      await mbToken.connect(owner).mint(depositor.address, mintAmount);
      expect(await mbToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount
      );
      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(0);

      await mbToken.connect(depositor).approve(gateway.address, swapAmount);

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(0);

      await gateway.connect(depositor).swapToNative(swapAmount);

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        swapAmount
      );
      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount.sub(swapAmount)
      );

      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount
      );

      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(swapAmount);
      expect(await mbToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount.sub(swapAmount)
      );
    });

    it("should allow users to swapToNativeTo", async function () {
      const mintAmount = ethers.utils.parseUnits("10", 18);
      const swapAmount = ethers.utils.parseUnits("4", 18);

      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount
      );
      expect(await mbToken.balanceOf(depositor.address)).to.be.equal(0);

      await mbToken.connect(owner).mint(depositor.address, mintAmount);
      expect(await mbToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount
      );
      expect(await mbToken.balanceOf(user1.address)).to.be.equal(0);
      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(0);

      await mbToken.connect(depositor).approve(gateway.address, swapAmount);

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(0);
      expect(await nativeToken.balanceOf(user1.address)).to.be.equal(0);

      await gateway
        .connect(depositor)
        .swapToNativeTo(swapAmount, user1.address);

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(0);
      expect(await nativeToken.balanceOf(user1.address)).to.be.equal(
        swapAmount
      );
      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount.sub(swapAmount)
      );

      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount
      );
      expect(await gateway.deposits(user1.address)).to.be.equal(0);

      expect(await mbToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount.sub(swapAmount)
      );
      expect(await mbToken.balanceOf(user1.address)).to.be.equal(0);
      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(swapAmount);
    });

    it("should allow users to swap native tokens to MBToken", async function () {
      const swapAmount = ethers.utils.parseUnits("4", 18);
      const mintAmount = ethers.utils.parseUnits("10", 18);

      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount
      );

      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(0);

      await mbToken.connect(owner).mint(gateway.address, mintAmount);
      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(mintAmount);

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(0);

      await nativeToken.connect(depositor).mint(depositor.address, mintAmount);
      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount
      );

      await nativeToken.connect(depositor).approve(gateway.address, swapAmount);
      await gateway.connect(depositor).swapToMBToken(swapAmount);

      expect(await mbToken.balanceOf(depositor.address)).to.be.equal(
        swapAmount
      );

      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(
        mintAmount.sub(swapAmount)
      );

      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount.sub(swapAmount)
      );

      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount.add(swapAmount)
      );

      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount
      );
    });

    it("should allow depositor to swapToMBTokenTo", async function () {
      const swapAmount = ethers.utils.parseUnits("4", 18);
      const mintAmount = ethers.utils.parseUnits("10", 18);

      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount
      );

      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(0);

      await mbToken.connect(owner).mint(gateway.address, mintAmount);

      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(mintAmount);
      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(0);

      await nativeToken.connect(depositor).mint(depositor.address, mintAmount);
      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount
      );

      await nativeToken.connect(depositor).approve(gateway.address, swapAmount);

      expect(await mbToken.balanceOf(depositor.address)).to.be.equal(0);
      expect(await mbToken.balanceOf(user1.address)).to.be.equal(0);

      await gateway
        .connect(depositor)
        .swapToMBTokenTo(swapAmount, user1.address);

      expect(await mbToken.balanceOf(depositor.address)).to.be.equal(0);
      expect(await mbToken.balanceOf(user1.address)).to.be.equal(swapAmount);
      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(
        mintAmount.sub(swapAmount)
      );

      expect(await nativeToken.balanceOf(user1.address)).to.be.equal(0);
      expect(await nativeToken.balanceOf(depositor.address)).to.be.equal(
        mintAmount.sub(swapAmount)
      );
      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        depositAmount.add(swapAmount)
      );

      expect(await gateway.deposits(depositor.address)).to.be.equal(
        depositAmount
      );
    });

    it("swapToNative should revert if swap amount is 0", async function () {
      await expect(gateway.swapToNative(0)).to.be.revertedWith(
        "Gateway: AMOUNT_MUST_BE_GREATER_THAN_0"
      );
    });

    it("swapToMBToken should revert if swap amount is 0", async function () {
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

  describe("Pausable functionality", function () {
    beforeEach(async function () {
      const PAUSER_ROLE = await gateway.PAUSER_ROLE();
      const UPAUSER_ROLE = await gateway.UNPAUSER_ROLE();
      await gateway.connect(owner).grantRole(PAUSER_ROLE, pauser.address);
      await gateway.connect(owner).grantRole(UPAUSER_ROLE, unPauser.address);
    });
    it("should not allow a user to pause the contract", async function () {
      await expect(gateway.connect(user).pause()).to.be.revertedWithCustomError(
        gateway,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should allow the pauser to pause the contract", async function () {
      await gateway.connect(pauser).pause();
      expect(await gateway.paused()).to.be.equal(true);
    });

    it("should allow the unPauser to unpause the contract", async function () {
      await gateway.connect(pauser).pause();
      expect(await gateway.connect(pauser).paused()).to.be.equal(true);

      await expect(
        gateway.connect(pauser).unpause()
      ).to.be.revertedWithCustomError(
        gateway,
        "AccessControlUnauthorizedAccount"
      );

      await expect(
        gateway.connect(owner).unpause()
      ).to.be.revertedWithCustomError(
        gateway,
        "AccessControlUnauthorizedAccount"
      );

      await expect(
        gateway.connect(user).unpause()
      ).to.be.revertedWithCustomError(
        gateway,
        "AccessControlUnauthorizedAccount"
      );

      await gateway.connect(unPauser).unpause();

      expect(await gateway.paused()).to.be.equal(false);
    });

    it("should revert when trying to perform an action while paused", async function () {
      const amount = ethers.utils.parseUnits("5", 18);
      const amount1 = ethers.utils.parseUnits("5", 18);

      await gateway.connect(pauser).pause();

      await expect(
        gateway.connect(user).swapToMBToken(amount)
      ).to.be.revertedWithCustomError(gateway, "EnforcedPause");

      await expect(
        gateway.connect(user).swapToNative(amount)
      ).to.be.revertedWithCustomError(gateway, "EnforcedPause");

      await expect(
        gateway.connect(user).swapToNativeTo(amount, user.address)
      ).to.be.revertedWithCustomError(gateway, "EnforcedPause");

      await expect(
        gateway.connect(user).swapToMBTokenTo(amount, user.address)
      ).to.be.revertedWithCustomError(gateway, "EnforcedPause");

      await expect(
        gateway.connect(user).deposit(amount)
      ).to.to.be.revertedWithCustomError(gateway, "EnforcedPause");

      await expect(
        gateway.connect(user).withdraw(amount, amount1)
      ).to.be.revertedWithCustomError(gateway, "EnforcedPause");
    });
  });
});
