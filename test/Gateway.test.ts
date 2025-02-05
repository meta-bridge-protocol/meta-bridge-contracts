import { expect, use } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import { describe, it, beforeEach } from "mocha";

import { MBToken, Gateway, Symemeio } from "../typechain-types";
import { BigNumber } from "ethers";

const ILzEndpointV2 = require("../artifacts/@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol/ILayerZeroEndpointV2.json");

describe("Gateway", function () {
  let gateway: Gateway;
  let mbToken: MBToken;
  let symemeio: Symemeio;
  let layerZeroEndPoint: MockContract;
  let owner: SignerWithAddress;
  let gatewayAdmin: SignerWithAddress;
  let user: SignerWithAddress;
  let user1: SignerWithAddress;
  let pauser: SignerWithAddress;
  let unPauser: SignerWithAddress;
  let mbTokenMinter: SignerWithAddress;
  let feeTreasury: SignerWithAddress;
  let initialPeriodStart: Number;
  let swappableAmount: BigNumber;
  const initialMaxSupply = ethers.utils.parseUnits("1000", 18);
  const initialUserMbTokenBalance = ethers.utils.parseUnits("10000", 18);
  const periodMaxAmount = ethers.utils.parseUnits("20", 18);
  const periodLimit = 864000;

  beforeEach(async function () {
    [owner, user, user1, pauser, unPauser, gatewayAdmin, mbTokenMinter, feeTreasury] =
      await ethers.getSigners();

    layerZeroEndPoint = await deployMockContract(owner, ILzEndpointV2.abi);

    await layerZeroEndPoint.mock.setDelegate.returns();

    await layerZeroEndPoint.mock.setConfig.returns();

    await layerZeroEndPoint.mock.eid.returns(1);

    const mbTokenFactory = await ethers.getContractFactory("MBToken");

    mbToken = await mbTokenFactory.deploy(
      "MyToken",
      "MTK",
      layerZeroEndPoint.address,
      owner.address
    );

    await mbToken
      .connect(owner)
      .grantRole(await mbToken.MINTER_ROLE(), mbTokenMinter.address);

    const symemeioFactory = await ethers.getContractFactory("Symemeio");

    symemeio = await symemeioFactory.deploy(
      initialMaxSupply,
      "symemeio",
      "sym"
    );
    await symemeio.deployed();

    const gatewayFactory = await ethers.getContractFactory(
      "contracts/Gateway.sol:Gateway"
    );

    gateway = (await gatewayFactory.deploy(
      gatewayAdmin.address,
      symemeio.address,
      mbToken.address
    )) as Gateway;

    initialPeriodStart = (await ethers.provider.getBlock("latest")).timestamp;

    await expect(
      mbToken.connect(user).setGateway(gateway.address)
    ).revertedWithCustomError(mbToken, "OwnableUnauthorizedAccount");

    await mbToken.connect(owner).setGateway(gateway.address);

    await symemeio
      .connect(owner)
      .grantRole(await symemeio.MINTER_ROLE(), gateway.address);

    await expect(
      mbToken.connect(user).mint(gateway.address, initialUserMbTokenBalance)
    ).revertedWithCustomError(mbToken, "AccessControlUnauthorizedAccount");

    expect(await mbToken.totalSupply()).to.be.equal(0);
    expect(await mbToken.balanceOf(user.address)).to.be.equal(0);

    await mbToken
      .connect(mbTokenMinter)
      .mint(user.address, initialUserMbTokenBalance);

    expect(await mbToken.balanceOf(user.address)).to.be.equal(
      initialUserMbTokenBalance
    );

    expect(await mbToken.totalSupply()).to.be.equal(initialUserMbTokenBalance);
  });

  describe("Check data after deploy", function () {
    it("should set maxSupply, token addresses, mbToken gateway, periodStart successfully", async function () {
      expect(await symemeio.maxSupply()).to.be.equal(initialMaxSupply);
      expect(await symemeio.totalSupply()).to.be.equal(0);
      expect(await gateway.nativeToken()).to.be.equal(symemeio.address);
      expect(await gateway.mbToken()).to.be.equal(mbToken.address);
      expect(await gateway.periodStart()).to.be.equal(initialPeriodStart);
      expect(await mbToken.gateway()).to.be.equal(gateway.address);
    });
  });

  describe("Swap", function () {
    const swapAmount = ethers.utils.parseUnits("10", 18);
    it("Should successfully swap with no limits set and amount below symemeio maxSupply", async function () {
      expect(await symemeio.totalSupply()).to.be.equal(0);

      swappableAmount = await gateway.swappableAmount();

      expect(swappableAmount).to.be.equal(initialMaxSupply);

      const amountToSwap =
        swappableAmount > swapAmount ? swapAmount : swappableAmount;

      expect(amountToSwap).equal(swapAmount);

      await expect(
        gateway.connect(user).swapToNative(swapAmount)
      ).to.be.revertedWithCustomError(mbToken, "ERC20InsufficientAllowance");

      await mbToken.connect(user).approve(gateway.address, swapAmount);
      await expect(gateway.connect(user).swapToNative(0)).to.rejectedWith(
        "Gateway: AMOUNT_MUST_BE_GREATER_THAN_0"
      );
      await gateway.connect(user).swapToNative(swapAmount);

      swappableAmount = await gateway.swappableAmount();

      const swappableAmountAfterFirstSwap = swappableAmount;

      expect(swappableAmount).to.be.equal(initialMaxSupply.sub(swapAmount));

      const mbTokenBalanceAfterFirstSwap = await mbToken.balanceOf(
        user.address
      );
      expect(mbTokenBalanceAfterFirstSwap).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );

      const mbTokenTotalSupplyAfterFirstSwap = await mbToken.totalSupply();
      expect(mbTokenTotalSupplyAfterFirstSwap).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );

      const symemeioUserBalanceAfterFirstSwap = await symemeio.balanceOf(
        user.address
      );
      expect(symemeioUserBalanceAfterFirstSwap).to.be.equal(amountToSwap);

      const symemeioTotalSupplyAfterFirstSwap = await symemeio.totalSupply();
      expect(symemeioTotalSupplyAfterFirstSwap).to.be.equal(amountToSwap);

      expect(await symemeio.maxSupply()).to.be.equal(initialMaxSupply);

      await mbToken.connect(user).approve(gateway.address, swapAmount);
      await gateway.connect(user).swapToNative(swapAmount);

      swappableAmount = await gateway.swappableAmount();

      expect(swappableAmount).to.be.equal(
        swappableAmountAfterFirstSwap.sub(swapAmount)
      );

      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        mbTokenBalanceAfterFirstSwap.sub(amountToSwap)
      );

      expect(await mbToken.totalSupply()).to.be.equal(
        mbTokenTotalSupplyAfterFirstSwap.sub(amountToSwap)
      );
      expect(await symemeio.balanceOf(user.address)).to.be.equal(
        symemeioUserBalanceAfterFirstSwap.add(amountToSwap)
      );
      expect(await symemeio.totalSupply()).to.be.equal(
        symemeioTotalSupplyAfterFirstSwap.add(amountToSwap)
      );
    });

    it("Should successfully swap with no limits set and amount with exceeding symemeio maxSupply.", async function () {
      const swapAmountTest = ethers.utils.parseUnits("2000", 18);
      await mbToken.connect(user).approve(gateway.address, swapAmountTest);

      expect(await symemeio.totalSupply()).to.be.equal(0);

      swappableAmount = await gateway.swappableAmount();

      expect(swappableAmount).to.be.equal(initialMaxSupply);

      const amountToSwap =
        swappableAmount > swapAmountTest ? swapAmountTest : swappableAmount;

      expect(amountToSwap).equals(initialMaxSupply);

      await gateway.connect(user).swapToNative(swapAmountTest);

      swappableAmount = await gateway.swappableAmount();

      expect(swappableAmount).to.be.equal(0);

      const userMbTokenBalance = await mbToken.balanceOf(user.address);
      expect(userMbTokenBalance).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );
      const userSymemioBalance = await symemeio.balanceOf(user.address);
      expect(userSymemioBalance).to.be.equal(amountToSwap);

      const mbTokenTotalSupply = await mbToken.totalSupply();
      expect(mbTokenTotalSupply).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );

      const symemeioTotalSupply = await symemeio.totalSupply();
      expect(symemeioTotalSupply).to.be.equal(amountToSwap);
      expect(await symemeio.maxSupply()).to.be.equal(initialMaxSupply);

      await mbToken.connect(user).approve(gateway.address, swapAmount);
      await gateway.connect(user).swapToNative(swapAmount);

      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        userMbTokenBalance
      );
      expect(await symemeio.balanceOf(user.address)).to.be.equal(
        userSymemioBalance
      );
      expect(await mbToken.totalSupply()).to.be.equal(mbTokenTotalSupply);
      expect(await symemeio.totalSupply()).to.be.equal(symemeioTotalSupply);
    });

    it("Should successfully swap with set limits (periodLimit and periodMaxAmount) exceeded periodMaxAmount", async function () {
      const swapAmountTest = ethers.utils.parseUnits("30", 18);
      await expect(
        gateway.connect(user).setLimits(periodLimit, periodMaxAmount)
      ).revertedWithCustomError(gateway, "AccessControlUnauthorizedAccount");

      await gateway
        .connect(gatewayAdmin)
        .setLimits(periodLimit, periodMaxAmount);

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);

      expect(await symemeio.totalSupply()).to.be.equal(0);

      swappableAmount = await gateway.swappableAmount();

      const amountToSwap =
        swappableAmount > swapAmountTest ? swapAmountTest : swappableAmount;

      expect(swappableAmount).to.be.equal(periodMaxAmount);
      expect(amountToSwap).to.be.equal(periodMaxAmount);

      //Swap exceeding the periodMaxAmountLimit.
      await gateway.connect(user).swapToNative(swapAmountTest);

      swappableAmount = await gateway.swappableAmount();

      expect(swappableAmount).to.be.equal(0);

      const userSymemioBalance = await symemeio.balanceOf(user.address);
      const symemeioTotalSupply = await symemeio.totalSupply();
      const userMbTokenBalance = await mbToken.balanceOf(user.address);
      const mbTokenTotalSupply = await await mbToken.totalSupply();

      expect(userSymemioBalance).to.be.equal(amountToSwap);
      expect(symemeioTotalSupply).to.be.equal(amountToSwap);
      expect(userMbTokenBalance).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );
      expect(mbTokenTotalSupply).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);
      await gateway.connect(user).swapToNative(swapAmountTest);
      expect(swappableAmount).to.be.equal(0);
      expect(await symemeio.balanceOf(user.address)).to.be.equal(
        userSymemioBalance
      );
      expect(await symemeio.totalSupply()).to.be.equal(symemeioTotalSupply);
      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        userMbTokenBalance
      );
      expect(await mbToken.totalSupply()).to.be.equal(mbTokenTotalSupply);
    });

    it("Should successfully swap with set limits (periodLimit and periodMaxAmount) exceeded period time", async function () {
      await gateway
        .connect(gatewayAdmin)
        .setLimits(periodLimit, periodMaxAmount);

      await mbToken.connect(user).approve(gateway.address, swapAmount);

      expect(await symemeio.totalSupply()).to.be.equal(0);

      swappableAmount = await gateway.swappableAmount();

      expect(swappableAmount).to.be.equal(periodMaxAmount);

      const amountToSwap =
        swappableAmount > swapAmount ? swapAmount : swappableAmount;

      expect(amountToSwap).to.be.equal(swapAmount);

      await gateway.connect(user).swapToNative(swapAmount);

      swappableAmount = await gateway.swappableAmount();

      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );
      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );
      expect(await symemeio.balanceOf(user.address)).to.be.equal(amountToSwap);
      expect(await symemeio.totalSupply()).to.be.equal(amountToSwap);
      expect(await symemeio.maxSupply()).to.be.equal(initialMaxSupply);

      const extraSwapAmount = ethers.utils.parseUnits("20", 18);
      await mbToken.connect(user).approve(gateway.address, extraSwapAmount);

      expect(swappableAmount).to.be.equal(periodMaxAmount.sub(amountToSwap));

      //increase one day and check swappable amount
      await ethers.provider.send("evm_increaseTime", [periodLimit]);
      await ethers.provider.send("evm_mine", []);

      swappableAmount = await gateway.swappableAmount();
      expect(swappableAmount).to.be.equal(periodMaxAmount);
    });

    it("Should successfully swap with set limits and fee below period max amount", async function () {
      const swapAmountTest = ethers.utils.parseUnits("15", 18);
      const feePercent = 1;
      const feeScale = 10;
      await gateway
        .connect(gatewayAdmin)
        .setLimits(periodLimit, periodMaxAmount);

      await expect(
        gateway.connect(user).setBurnFee(feePercent, feeScale)
      ).revertedWithCustomError(gateway, "AccessControlUnauthorizedAccount");

      await gateway.connect(gatewayAdmin).setBurnFee(feePercent, feeScale);

      expect(await gateway.burnFee()).to.be.equals(feePercent);
      expect(await gateway.burnFeeScale()).to.be.equals(feeScale);

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);

      expect(await gateway.swappableAmount()).to.be.equal(periodMaxAmount);

      expect(await symemeio.balanceOf(user.address)).to.be.equal(0);

      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        initialUserMbTokenBalance
      );

      expect(await symemeio.totalSupply()).to.be.equal(0);

      swappableAmount = await gateway.swappableAmount();
      expect(swappableAmount).equal(periodMaxAmount);

      const amountToSwap =
        swappableAmount > swapAmountTest ? swapAmountTest : swappableAmount;

      expect(amountToSwap).to.be.equal(swapAmountTest);

      await gateway.connect(user).swapToNative(swapAmountTest);

      swappableAmount = await gateway.swappableAmount();

      const netAmount = amountToSwap.sub(
        amountToSwap.mul(feePercent).div(feeScale)
      );

      expect(swappableAmount).equal(periodMaxAmount.sub(netAmount));

      expect(await symemeio.totalSupply()).to.be.equal(netAmount);

      expect(await symemeio.balanceOf(user.address)).to.be.equal(netAmount);
      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );
      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );
    });

    it("Should successfully swap with set limits and fee exceeded period max amount", async function () {
      const swapAmountTest = ethers.utils.parseUnits("50", 18);
      const feePercent = 1;
      const feeScale = 10;
      await gateway
        .connect(gatewayAdmin)
        .setLimits(periodLimit, periodMaxAmount);

      await expect(
        gateway.connect(user).setBurnFee(feePercent, feeScale)
      ).revertedWithCustomError(gateway, "AccessControlUnauthorizedAccount");

      await gateway.connect(gatewayAdmin).setBurnFee(feePercent, feeScale);

      expect(await gateway.burnFee()).to.be.equals(feePercent);
      expect(await gateway.burnFeeScale()).to.be.equals(feeScale);

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);

      expect(await gateway.swappableAmount()).to.be.equal(periodMaxAmount);

      expect(await symemeio.balanceOf(user.address)).to.be.equal(0);

      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        initialUserMbTokenBalance
      );

      expect(await symemeio.totalSupply()).to.be.equal(0);

      swappableAmount = await gateway.swappableAmount();

      expect(swappableAmount).equal(periodMaxAmount);

      await gateway.connect(user).swapToNative(swapAmountTest);

      const amountToSwap =
        swappableAmount > swapAmountTest ? swapAmountTest : swappableAmount;

      expect(amountToSwap).to.be.equal(swappableAmount);

      const netAmount = amountToSwap.sub(
        amountToSwap.mul(feePercent).div(feeScale)
      );

      swappableAmount = await gateway.swappableAmount();
      expect(swappableAmount).equal(periodMaxAmount.sub(netAmount));

      expect(await symemeio.totalSupply()).to.be.equal(netAmount);

      expect(await symemeio.balanceOf(user.address)).to.be.equal(netAmount);

      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );
      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );
    });

    it("it Should swapToNativeTo an address successfully below the periodMaxAmount", async function () {
      expect(await symemeio.totalSupply()).to.be.equal(0);

      await gateway
        .connect(gatewayAdmin)
        .setLimits(periodLimit, periodMaxAmount);

      swappableAmount = await gateway.swappableAmount();

      expect(swappableAmount).to.be.equal(periodMaxAmount);

      const amountToSwap =
        swappableAmount > swapAmount ? swapAmount : swappableAmount;

      expect(amountToSwap).equal(swapAmount);

      await expect(
        gateway.connect(user).swapToNative(swapAmount)
      ).to.be.revertedWithCustomError(mbToken, "ERC20InsufficientAllowance");

      await mbToken.connect(user).approve(gateway.address, swapAmount);

      expect(await symemeio.balanceOf(user.address)).to.be.equal(0);
      expect(await symemeio.balanceOf(user1.address)).to.be.equal(0);

      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        initialUserMbTokenBalance
      );

      expect(await mbToken.balanceOf(user1.address)).to.be.equal(0);

      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance
      );

      await gateway.connect(user).swapToNativeTo(swapAmount, user1.address);

      expect(await symemeio.balanceOf(user.address)).to.be.equal(0);
      expect(await symemeio.balanceOf(user1.address)).to.be.equal(amountToSwap);
      expect(await symemeio.totalSupply()).to.be.equal(amountToSwap);
      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );
      expect(await mbToken.balanceOf(user1.address)).to.be.equal(0);

      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );
    });

    it("it Should swapToNativeTo an address successfully exceeded periodMaxAmount", async function () {
      const swapAmountTest = ethers.utils.parseUnits("30", 18);

      expect(await symemeio.totalSupply()).to.be.equal(0);

      await gateway
        .connect(gatewayAdmin)
        .setLimits(periodLimit, periodMaxAmount);

      swappableAmount = await gateway.swappableAmount();

      expect(swappableAmount).to.be.equal(periodMaxAmount);

      const amountToSwap =
        swappableAmount > swapAmountTest ? swapAmountTest : swappableAmount;

      expect(amountToSwap).equal(swappableAmount);

      await expect(
        gateway.connect(user).swapToNative(swapAmountTest)
      ).to.be.revertedWithCustomError(mbToken, "ERC20InsufficientAllowance");

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);

      expect(await symemeio.balanceOf(user.address)).to.be.equal(0);
      expect(await symemeio.balanceOf(user1.address)).to.be.equal(0);

      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        initialUserMbTokenBalance
      );
      expect(await mbToken.balanceOf(user1.address)).to.be.equal(0);

      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance
      );

      await gateway.connect(user).swapToNativeTo(swapAmountTest, user1.address);

      expect(await symemeio.balanceOf(user.address)).to.be.equal(0);
      expect(await symemeio.balanceOf(user1.address)).to.be.equal(amountToSwap);

      expect(await symemeio.totalSupply()).to.be.equal(amountToSwap);
      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        initialUserMbTokenBalance.sub(swapAmountTest)
      );
      expect(await mbToken.balanceOf(user1.address)).to.be.equal(
        swapAmountTest.sub(amountToSwap)
      );

      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(amountToSwap)
      );
    });

    it("Should calculate the correct netAmount with minimal fee (feePercent = 1, feeScale = 1000)", async function () {
      const swapAmountTest = ethers.utils.parseUnits("1000", 18);
      const feePercent = 1;
      const feeScale = 1000;

      await gateway.connect(gatewayAdmin).setBurnFee(feePercent, feeScale);

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);

      await gateway.connect(user).swapToNative(swapAmountTest);

      const feeAmount = swapAmountTest.mul(feePercent).div(feeScale);
      const expectedNetAmount = swapAmountTest.sub(feeAmount);

      const userBalance = await symemeio.balanceOf(user.address);
      expect(userBalance).to.be.equal(expectedNetAmount);

      const expectedTotalSupply = initialUserMbTokenBalance.sub(swapAmountTest);
      const currentTotalSupply = await mbToken.totalSupply();
      expect(currentTotalSupply).to.be.equal(expectedTotalSupply);
    });

    it("Should work correctly with no fee (feePercent = 0)", async function () {
      const swapAmountTest = ethers.utils.parseUnits("50", 18);
      const feePercent = 0; // No fee
      const feeScale = 100;

      await gateway.connect(gatewayAdmin).setBurnFee(feePercent, feeScale);

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);
      await gateway.connect(user).swapToNative(swapAmountTest);

      // Calculate expected values
      const feeAmount = swapAmountTest.mul(feePercent).div(feeScale); // fee = 0
      const netAmount = swapAmountTest.sub(feeAmount); // netAmount = swapAmount

      expect(await symemeio.balanceOf(user.address)).to.be.equal(netAmount);
      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(swapAmountTest)
      );
    });

    it("Should work with treasuryFee & burnFee", async function () {
      const swapAmount = ethers.utils.parseUnits("50", 18);
      const burnFee = 2;
      const burnFeeScale = 100;

      const treasuryFee = 1;
      const treasuryFeeScale = 100;

      const totalSupply = await symemeio.totalSupply();

      expect(await gateway.burnFee()).to.be.equal(0);
      expect(await gateway.burnFeeScale()).to.be.equal(100);
      expect(await gateway.feeTreasury()).to.be.equal(ethers.constants.AddressZero);
      expect(await gateway.treasuryFee()).to.be.equal(0);
      expect(await gateway.treasuryFeeScale()).to.be.equal(100);

      await gateway.connect(gatewayAdmin).setBurnFee(burnFee, burnFeeScale);
      await gateway.connect(gatewayAdmin).setFeeTreasuryAddress(feeTreasury.address);
      await gateway.connect(gatewayAdmin).setTreasuryFee(treasuryFee, treasuryFeeScale);

      expect(await symemeio.balanceOf(user.address)).to.be.equal(0);
      expect(await gateway.burnFee()).to.be.equal(burnFee);
      expect(await gateway.burnFeeScale()).to.be.equal(burnFeeScale);
      expect(await gateway.treasuryFee()).to.be.equal(treasuryFee);
      expect(await gateway.treasuryFeeScale()).to.be.equal(treasuryFeeScale);

      await mbToken.connect(user).approve(gateway.address, swapAmount);
      await gateway.connect(user).swapToNative(swapAmount);

      expect(await symemeio.balanceOf(user.address)).to.be.equal(ethers.utils.parseUnits("48.5", 18));
      expect(await symemeio.balanceOf(feeTreasury.address)).to.be.equal(ethers.utils.parseUnits("0.5", 18));
      expect(await symemeio.totalSupply()).to.be.equal(
        totalSupply.add(ethers.utils.parseUnits("49", 18))
      );
      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(swapAmount)
      );
    });

    it("Should work correctly with maximum fee (feePercent = feeScale)", async function () {
      const swapAmountTest = ethers.utils.parseUnits("50", 18);
      const feePercent = 100; // Maximum fee
      const feeScale = 100; // 100% fee scaling

      await gateway.connect(gatewayAdmin).setBurnFee(feePercent, feeScale);

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);
      await gateway.connect(user).swapToNative(swapAmountTest);

      const feeAmount = swapAmountTest.mul(feePercent).div(feeScale); // fee = swapAmount
      const netAmount = swapAmountTest.sub(feeAmount); // netAmount = 0

      expect(await symemeio.balanceOf(user.address)).to.be.equal(netAmount);
      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(swapAmountTest)
      );
    });

    it("Should work correctly with half fee (feePercent = feeScale / 2)", async function () {
      const swapAmountTest = ethers.utils.parseUnits("50", 18);
      const feePercent = 50; // 50% fee
      const feeScale = 100; // Scaling factor

      await gateway.connect(gatewayAdmin).setBurnFee(feePercent, feeScale);

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);
      await gateway.connect(user).swapToNative(swapAmountTest);

      const feeAmount = swapAmountTest.mul(feePercent).div(feeScale); // fee = swapAmount * 50 / 100
      const netAmount = swapAmountTest.sub(feeAmount); // netAmount = swapAmount - fee

      expect(await symemeio.balanceOf(user.address)).to.be.equal(netAmount);
      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(swapAmountTest)
      );
    });

    it("Should work correctly with a small decimal fee (feePercent = 0.5%)", async function () {
      const swapAmountTest = ethers.utils.parseUnits("50", 18);
      const feePercent = 0.5; // 0.5% fee
      const feeScale = 100; // Scaling factor

      await gateway
        .connect(gatewayAdmin)
        .setBurnFee(feePercent * 100, feeScale * 100);

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);
      await gateway.connect(user).swapToNative(swapAmountTest);

      const feeAmount = swapAmountTest
        .mul(feePercent * 100)
        .div(feeScale * 100); // fee = swapAmount * 0.005
      const netAmount = swapAmountTest.sub(feeAmount); // netAmount = swapAmount - fee

      expect(await symemeio.balanceOf(user.address)).to.be.equal(netAmount);
      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(swapAmountTest)
      );
    });

    it("Should handle very small swap amounts (e.g., 0.0001)", async function () {
      const swapAmountTest = ethers.utils.parseUnits("0.0001", 18); // Small amount to swap
      const feePercent = 10; // 10% fee
      const feeScale = 100; // Scaling factor

      await gateway.connect(gatewayAdmin).setBurnFee(feePercent, feeScale);

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);
      await gateway.connect(user).swapToNative(swapAmountTest);

      const feeAmount = swapAmountTest.mul(feePercent).div(feeScale); // fee = 0.0001 * 0.1
      const netAmount = swapAmountTest.sub(feeAmount); // netAmount = swapAmount - fee

      expect(await symemeio.balanceOf(user.address)).to.be.equal(netAmount);
      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(swapAmountTest)
      );
    });

    it("Should handle decimal amounts for swap", async function () {
      const swapAmountTest = ethers.utils.parseUnits("123.45672", 18); // Precise decimal amount
      const feePercent = 2.5; // 2.5% fee
      const feeScale = 100; // Scaling factor

      await gateway
        .connect(gatewayAdmin)
        .setBurnFee(feePercent * 100, feeScale * 100);

      await mbToken.connect(user).approve(gateway.address, swapAmountTest);
      await gateway.connect(user).swapToNative(swapAmountTest);

      // Calculate expected values
      const feeAmount = swapAmountTest
        .mul(feePercent * 100)
        .div(feeScale * 100); // fee = swapAmount * 0.025
      const netAmount = swapAmountTest.sub(feeAmount); // netAmount = swapAmount - fee

      expect(await symemeio.balanceOf(user.address)).to.be.equal(netAmount);
      expect(await mbToken.totalSupply()).to.be.equal(
        initialUserMbTokenBalance.sub(swapAmountTest)
      );
    });
  });

  describe("Roles", async function () {
    it("Should pauser and unPauser can pause and unPause contract successfully", async () => {
      await expect(
        gateway
          .connect(user)
          .grantRole(await gateway.PAUSER_ROLE(), pauser.address)
      ).to.be.revertedWithCustomError(
        gateway,
        "AccessControlUnauthorizedAccount"
      );

      await gateway
        .connect(gatewayAdmin)
        .grantRole(await gateway.PAUSER_ROLE(), pauser.address);

      expect(await gateway.paused()).to.be.equal(false);

      await expect(gateway.connect(user).pause()).revertedWithCustomError(
        gateway,
        "AccessControlUnauthorizedAccount"
      );
      expect(await gateway.paused()).to.be.equal(false);

      await gateway.connect(pauser).pause();

      expect(await gateway.paused()).to.be.equal(true);

      await expect(
        gateway.connect(pauser).unpause()
      ).to.be.revertedWithCustomError(
        gateway,
        "AccessControlUnauthorizedAccount"
      );

      await expect(
        gateway.connect(gatewayAdmin).unpause()
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

      await gateway
        .connect(gatewayAdmin)
        .grantRole(await gateway.UNPAUSER_ROLE(), unPauser.address);

      await gateway.connect(unPauser).unpause();

      expect(await gateway.paused()).to.be.equal(false);
    });

    it("Should admin set limits correctly", async () => {
      await expect(
        gateway.connect(user).setLimits(periodLimit, periodMaxAmount)
      ).revertedWithCustomError(gateway, "AccessControlUnauthorizedAccount");

      expect(await gateway.periodLength()).to.be.equals(0);
      expect(await gateway.periodMaxAmount()).to.be.equals(0);

      await gateway
        .connect(gatewayAdmin)
        .setLimits(periodLimit, periodMaxAmount);

      expect(await gateway.periodLength()).to.be.equals(periodLimit);
      expect(await gateway.periodMaxAmount()).to.be.equals(periodMaxAmount);
    });

    it("Should admin set fee correctly", async () => {
      const feePercent = 1;
      const feeScale = 10;
      await expect(
        gateway.connect(user).setBurnFee(feePercent, feeScale)
      ).revertedWithCustomError(gateway, "AccessControlUnauthorizedAccount");

      expect(await gateway.burnFee()).to.be.equals(0);
      expect(await gateway.burnFeeScale()).to.be.equals(100);

      await gateway.connect(gatewayAdmin).setBurnFee(feePercent, feeScale);

      expect(await gateway.burnFee()).to.be.equals(feePercent);
      expect(await gateway.burnFeeScale()).to.be.equals(feeScale);
    });
  });

  describe("check paused functions", async () => {
    it("Should revert swap when contract is paused", async () => {
      const swapAmount = ethers.utils.parseUnits("10", 18);
      await gateway
        .connect(gatewayAdmin)
        .grantRole(await gateway.PAUSER_ROLE(), pauser.address);
      await gateway.connect(pauser).pause();
      await mbToken.connect(user).approve(gateway.address, swapAmount);
      expect(await symemeio.balanceOf(user.address)).to.be.equals(0);
      expect(await symemeio.balanceOf(user1.address)).to.be.equals(0);
      expect(await symemeio.totalSupply()).to.be.equals(0);

      expect(await mbToken.balanceOf(user.address)).to.be.equals(
        initialUserMbTokenBalance
      );
      expect(await mbToken.balanceOf(user1.address)).to.be.equals(0);
      expect(await mbToken.totalSupply()).to.be.equals(
        initialUserMbTokenBalance
      );

      await expect(
        gateway.connect(user).swapToNative(swapAmount)
      ).revertedWithCustomError(gateway, "EnforcedPause");

      await expect(
        gateway.connect(user).swapToNativeTo(swapAmount, user1.address)
      ).revertedWithCustomError(gateway, "EnforcedPause");

      expect(await symemeio.balanceOf(user.address)).to.be.equals(0);
      expect(await symemeio.balanceOf(user1.address)).to.be.equals(0);
      expect(await symemeio.totalSupply()).to.be.equals(0);
      expect(await mbToken.balanceOf(user.address)).to.be.equals(
        initialUserMbTokenBalance
      );
      expect(await mbToken.balanceOf(user1.address)).to.be.equals(0);
      expect(await mbToken.totalSupply()).to.be.equals(
        initialUserMbTokenBalance
      );
    });
  });

  describe("Admin withdraw", () => {
    const amount = ethers.utils.parseUnits("20", 18);
    const withdrawAmount = ethers.utils.parseUnits("5", 18);
    it("Should admin withdraw token successfully", async () => {
      await mbToken.connect(mbTokenMinter).mint(gateway.address, amount);
      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(amount);
      expect(await mbToken.balanceOf(gatewayAdmin.address)).to.be.equal(0);

      await expect(
        gateway
          .connect(user)
          .adminWithdraw(withdrawAmount, user.address, mbToken.address)
      ).to.be.revertedWithCustomError(
        gateway,
        "AccessControlUnauthorizedAccount"
      );

      await gateway
        .connect(gatewayAdmin)
        .adminWithdraw(withdrawAmount, gatewayAdmin.address, mbToken.address);

      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(
        amount.sub(withdrawAmount)
      );

      expect(await mbToken.balanceOf(gatewayAdmin.address)).to.be.equal(
        withdrawAmount
      );

      await gateway
        .connect(gatewayAdmin)
        .adminWithdraw(withdrawAmount, user1.address, mbToken.address);

      expect(await mbToken.balanceOf(gatewayAdmin.address)).to.be.equal(
        withdrawAmount
      );

      expect(await mbToken.balanceOf(user1.address)).to.be.equal(
        withdrawAmount
      );

      expect(await mbToken.balanceOf(gateway.address)).to.be.equal(
        amount.sub(withdrawAmount).sub(withdrawAmount)
      );
    });
  });
});
