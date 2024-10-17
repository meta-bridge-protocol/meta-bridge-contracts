import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import MBToken_ABI from "../artifacts/contracts/MBToken.sol/MBToken.json";
import GATEWAY_ABI from "./abi/GatewayV2.json";
import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import { Escrow } from "../typechain-types";
import { describe, it, beforeEach } from "mocha";

describe("Escrow", () => {
  let escrow: Escrow;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let withdrawer: SignerWithAddress;
  let assetManager: SignerWithAddress;
  let mockGateway: MockContract;
  let mockToken: MockContract;

  const initialThreshold = ethers.utils.parseEther("100");
  const depositAmount = ethers.utils.parseEther("50");
  const withdrawAmount = ethers.utils.parseEther("50");

  beforeEach(async () => {
    [owner, depositor, withdrawer, assetManager] = await ethers.getSigners();

    // Deploying mock contracts for testing
    mockToken = await deployMockContract(owner, MBToken_ABI.abi);
    mockGateway = await deployMockContract(owner, GATEWAY_ABI);

    // Setting mock functions to return the expected values
    await mockGateway.mock.nativeToken.returns(mockToken.address);
    await mockGateway.mock.mbToken.returns(mockToken.address);

    // Deploying the Escrow contract
    const EscrowFactory = await ethers.getContractFactory("Escrow");
    escrow = await EscrowFactory.deploy();

    // Initializing the Escrow contract
    await escrow.initialize(
      mockGateway.address,
      owner.address,
      initialThreshold
    );

    // Granting roles
    await escrow.grantRole(await escrow.DEPOSITOR_ROLE(), depositor.address);
    await escrow.grantRole(await escrow.WITHDRAWER_ROLE(), withdrawer.address);
    await escrow.grantRole(
      await escrow.ASSET_MANAGER_ROLE(),
      assetManager.address
    );
  });

  describe("Deployment", () => {
    it("should set the correct initial parameters", async () => {
      expect(await escrow.nativeTokenAddress()).to.equal(mockToken.address);
      expect(await escrow.treasureAddress()).to.equal(owner.address);
      expect(await escrow.thresholdAmount()).to.equal(initialThreshold);
    });
  });

  describe("Deposit Functionality", () => {
    it("should allow the depositor to deposit tokens if below threshold", async () => {
      // Setup the mock to return a balance of 0
      await mockToken.mock.balanceOf.withArgs(mockGateway.address).returns(0);
      await mockToken.mock.balanceOf
        .withArgs(escrow.address)
        .returns(depositAmount);
      await mockToken.mock.approve
        .withArgs(mockGateway.address, depositAmount)
        .returns(true);
      await mockGateway.mock.deposit.withArgs(depositAmount).returns();

      //Deposit
      await expect(escrow.connect(depositor).depositToGateway())
        .to.emit(escrow, "DepositToGateway")
        .withArgs(depositAmount, initialThreshold);
    });

    it("should revert if the gateway balance exceeds the threshold", async () => {
      // Setup the mock to return a balance above the threshold
      await mockToken.mock.balanceOf
        .withArgs(mockGateway.address)
        .returns(initialThreshold.add(1));
      await expect(
        escrow.connect(depositor).depositToGateway()
      ).to.be.revertedWith("Escrow: Gateway balance exceeds the threshold");
    });
  });

  describe("Withdraw Functionality", () => {
    it("should allow the withdrawer to withdraw tokens if above threshold", async () => {
      // Setup the mock to return a balance above the threshold
      await mockToken.mock.balanceOf
        .withArgs(mockGateway.address)
        .returns(initialThreshold.add(withdrawAmount));
      await mockGateway.mock.withdraw.withArgs(withdrawAmount, 0).returns();

      // Withdraw
      await expect(escrow.connect(withdrawer).withdrawFromGateway())
        .to.emit(escrow, "WithdrawFromGateway")
        .withArgs(withdrawAmount, initialThreshold);
    });

    it("should revert if the gateway balance is below the threshold", async () => {
      // Setup the mock to return a balance below the threshold
      await mockToken.mock.balanceOf
        .withArgs(mockGateway.address)
        .returns(initialThreshold.sub(1));
      await expect(
        escrow.connect(withdrawer).withdrawFromGateway()
      ).to.be.revertedWith("Escrow: Gateway balance is below the threshold");
    });
  });

  describe("Threshold Management", () => {
    const newThreshold = ethers.utils.parseEther("200");
    it("should allow the admin to set a new threshold amount", async () => {
      await expect(escrow.connect(owner).setThresholdAmount(newThreshold))
        .to.emit(escrow, "SetThresholdAmount")
        .withArgs(newThreshold);
      expect(await escrow.thresholdAmount()).to.equal(newThreshold);
    });

    it("should revert if a non-admin tries to set a new threshold", async () => {
      await expect(escrow.connect(depositor).setThresholdAmount(newThreshold))
        .to.be.reverted;
    });
  });

  describe("Treasure Address Management", () => {
    it("should allow the admin to change the treasure address", async () => {
      const newTreasureAddress = ethers.Wallet.createRandom().address;

      await expect(escrow.connect(owner).setTreasureAddress(newTreasureAddress))
        .to.emit(escrow, "TreasureChanged")
        .withArgs(owner.address, newTreasureAddress);

      expect(await escrow.treasureAddress()).to.equal(newTreasureAddress);
    });

    it("should revert if a non-admin tries to change the treasure address", async () => {
      const newTreasureAddress = ethers.Wallet.createRandom().address;
      await expect(
        escrow.connect(depositor).setTreasureAddress(newTreasureAddress)
      ).to.be.reverted;
      //   revertedWith("AccessControl: account is missing role");
    });

    it("should revert when setting treasure address to address(0)", async function () {
      await expect(
        escrow.setTreasureAddress(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid treasure address");
    });
  });

  describe("ERC20 Withdrawal", () => {
    it("should allow the asset manager to withdraw ERC20 tokens", async () => {
      const withdrawAmount = ethers.utils.parseEther("10");
      await mockToken.mock.transfer
        .withArgs(owner.address, withdrawAmount)
        .returns(true);

      await expect(
        escrow
          .connect(assetManager)
          .withdrawERC20(mockToken.address, withdrawAmount)
      )
        .to.emit(escrow, "WithdrawERC20")
        .withArgs(mockToken.address, owner.address, withdrawAmount);
    });

    it("should revert if a non-asset manager tries to withdraw ERC20 tokens", async () => {
      await expect(
        escrow
          .connect(depositor)
          .withdrawERC20(mockToken.address, ethers.utils.parseEther("10"))
      ).to.be.reverted;
      //   .to.be.revertedWith("AccessControl: account is missing role");
    });
  });

  describe("AccessControl roles", () => {
    it("should revert when non-admin tries to set threshold", async function () {
      // Non-admin user tries to set threshold
      await expect(
        escrow
          .connect(depositor)
          .setThresholdAmount(ethers.utils.parseEther("100"))
      ).to.be.revertedWith("AccessControl: account is missing role");
    });

    it("should allow admin to set threshold", async function () {
      // Admin sets the threshold successfully
      await expect(
        escrow.connect(owner).setThresholdAmount(ethers.utils.parseEther("100"))
      )
        .to.emit(escrow, "SetThresholdAmount")
        .withArgs(ethers.utils.parseEther("100"));
    });
  });
});
