import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import MBToken_ABI from "../artifacts/contracts/MBToken.sol/MBToken.json";
import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import { describe, it, beforeEach } from "mocha";

describe("Gateway", function () {
  let gateway: any;
  let mbToken: MockContract;
  let nativeToken: MockContract;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    // Deploy mock contracts for MBToken and NativeToken
    [owner, user] = await ethers.getSigners();

    nativeToken = await deployMockContract(owner, MBToken_ABI.abi);
    mbToken = await deployMockContract(owner, MBToken_ABI.abi);

    // Deploy the Gateway contract
    const Gateway = await ethers.getContractFactory("Gateway");
    gateway = await Gateway.deploy(
      owner.address,
      nativeToken.address,
      mbToken.address
    );
    await gateway.deployed();

    // Mint some tokens to the user
    await nativeToken.mock.balanceOf.returns(0);
    await nativeToken.mock.transferFrom.returns(true);
    await mbToken.mock.balanceOf.returns(0);
  });

  describe("Deposit", function () {
    // it("should allow users to deposit native tokens", async function () {
    //   const depositAmount = ethers.utils.parseUnits("10", 18);

    //   await nativeToken.mock.balanceOf
    //     .withArgs(user.address)
    //     .returns(depositAmount);

    //   await nativeToken.mock.approve
    //     .withArgs(gateway.address, depositAmount)
    //     .returns(true);

    //   await gateway.connect(user).deposit(depositAmount);

    //   await nativeToken.mock.balanceOf.withArgs(gateway.address).returns(0);

    //   await nativeToken.mock.transferFrom
    //     .withArgs(user.address, gateway.address, depositAmount)
    //     .returns(true);

    //   await nativeToken.mock.balanceOf
    //     .withArgs(gateway.address)
    //     .returns(depositAmount);

    //   expect(await gateway.deposits(user.address)).to.equal(depositAmount);

    //   const gatewayBalance = await nativeToken.balanceOf(gateway.address);
    //   expect(gatewayBalance).to.equal(depositAmount);

    //   const receivedAmount = await nativeToken.balanceOf(gateway.address);
    //   expect(receivedAmount).to.equal(depositAmount);
    // });

    it("should revert if deposit amount is 0", async function () {
      await expect(gateway.deposit(0)).to.be.revertedWith(
        "Gateway: TOTAL_DEPOSIT_MUST_BE_GREATER_THAN_0"
      );
    });
  });

  // describe("Withdraw", function () {
  //   beforeEach(async function () {
  //     const depositAmount = ethers.utils.parseUnits("10", 18);
  //     await nativeToken.mock.balanceOf
  //       .withArgs(gateway.address)
  //       .returns(depositAmount);
  //     await gateway.deposit(depositAmount);
  //   });

  //   it("should allow users to withdraw native and mb tokens", async function () {
  //     const withdrawNativeAmount = ethers.utils.parseUnits("5", 18);
  //     const withdrawMBTokenAmount = ethers.utils.parseUnits("5", 18);

  //     await nativeToken.mock.balanceOf
  //       .withArgs(gateway.address)
  //       .returns(withdrawNativeAmount);
  //     await mbToken.mock.balanceOf
  //       .withArgs(gateway.address)
  //       .returns(withdrawMBTokenAmount);

  //     await gateway.withdraw(withdrawNativeAmount, withdrawMBTokenAmount);

  //     expect(await gateway.deposits(user.address)).to.equal(
  //       ethers.utils.parseUnits("5", 18)
  //     ); // 10 - 5
  //   });

  //   it("should revert if total withdrawal amount is 0", async function () {
  //     await expect(gateway.withdraw(0, 0)).to.be.revertedWith(
  //       "Gateway: TOTAL_WITHDRAWAL_MUST_BE_GREATER_THAN_0"
  //     );
  //   });

  //   it("should revert if user has insufficient balance", async function () {
  //     await expect(
  //       gateway.withdraw(ethers.utils.parseUnits("20", 18), 0)
  //     ).to.be.revertedWith("Gateway: INSUFFICIENT_USER_BALANCE");
  //   });
  // });

  // describe("Swaps", function () {
  //   beforeEach(async function () {
  //     const depositAmount = ethers.utils.parseUnits("10", 18);
  //     await nativeToken.mock.balanceOf
  //       .withArgs(gateway.address)
  //       .returns(depositAmount);
  //     await gateway.deposit(depositAmount);
  //   });

  //   it("should allow users to swap MBToken to native tokens", async function () {
  //     const swapAmount = ethers.utils.parseUnits("5", 18);
  //     await mbToken.mock.balanceOf.withArgs(user.address).returns(swapAmount);
  //     await mbToken.mock.transferFrom.returns(true);
  //     await nativeToken.mock.transfer.returns(true);

  //     await gateway.swapToNative(swapAmount);

  //     expect(await nativeToken.balanceOf(user.address)).to.equal(swapAmount);
  //   });

  //   it("should allow users to swap native tokens to MBToken", async function () {
  //     const swapAmount = ethers.utils.parseUnits("5", 18);
  //     await nativeToken.mock.balanceOf
  //       .withArgs(user.address)
  //       .returns(swapAmount);
  //     await nativeToken.mock.transferFrom.returns(true);
  //     await mbToken.mock.transfer.returns(true);

  //     await gateway.swapToMBToken(swapAmount);

  //     expect(await mbToken.balanceOf(user.address)).to.equal(swapAmount);
  //   });

  //   it("should revert if swap amount is 0", async function () {
  //     await expect(gateway.swapToNative(0)).to.be.revertedWith(
  //       "Gateway: AMOUNT_MUST_BE_GREATER_THAN_0"
  //     );
  //   });

  //   it("should revert if recipient address is zero", async function () {
  //     await expect(
  //       gateway.swapToNativeTo(
  //         ethers.utils.parseUnits("5", 18),
  //         ethers.constants.AddressZero
  //       )
  //     ).to.be.revertedWith("Gateway: RECIPIENT_ADDRESS_MUST_BE_NON-ZERO");
  //   });
  // });

  // describe("Simultaneous Actions", function () {
  //   beforeEach(async function () {
  //     const depositAmount = ethers.utils.parseUnits("10", 18);
  //     await nativeToken.mock.balanceOf
  //       .withArgs(gateway.address)
  //       .returns(depositAmount);
  //     await gateway.deposit(depositAmount);
  //   });

  //   it("should handle simultaneous deposits and withdrawals", async function () {
  //     const depositAmount = ethers.utils.parseUnits("5", 18);
  //     const withdrawAmount = ethers.utils.parseUnits("5", 18);

  //     // Simulating deposit and withdrawal
  //     await gateway.deposit(depositAmount);
  //     await gateway.withdraw(withdrawAmount, 0); // Withdrawing native tokens only

  //     expect(await gateway.deposits(user.address)).to.equal(
  //       ethers.utils.parseUnits("10", 18)
  //     ); // 10 + 5 - 5
  //   });

  //   it("should allow swapping while depositing", async function () {
  //     const depositAmount = ethers.utils.parseUnits("5", 18);
  //     const swapAmount = ethers.utils.parseUnits("5", 18);

  //     await nativeToken.mock.balanceOf
  //       .withArgs(gateway.address)
  //       .returns(depositAmount);
  //     await mbToken.mock.balanceOf.withArgs(user.address).returns(swapAmount);
  //     await mbToken.mock.transferFrom.returns(true);
  //     await nativeToken.mock.transfer.returns(true);

  //     // Deposit and swap in the same transaction
  //     await gateway.deposit(depositAmount);
  //     await gateway.swapToNative(swapAmount);

  //     expect(await nativeToken.balanceOf(user.address)).to.equal(swapAmount);
  //     expect(await gateway.deposits(user.address)).to.equal(depositAmount); // Check deposit balance
  //   });
  // });

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
