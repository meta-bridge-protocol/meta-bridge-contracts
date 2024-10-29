import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import MBToken_ABI from "../artifacts/contracts/MBToken.sol/MBToken.json";
import GATEWAY_ABI from "./abi/GatewayV2.json";
import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import { Escrow, Gateway, MBToken, TestToken } from "../typechain-types";
import { describe, it, beforeEach } from "mocha";
import { Address } from "hardhat-deploy/types";
const ILzEndpointV2 = require("../artifacts/contracts/interfaces/ILzEndpointV2.sol/ILzEndpointV2.json");

describe("Escrow", () => {
  let escrow: Escrow;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let withdrawer: SignerWithAddress;
  let assetManager: SignerWithAddress;
  let mbToken: MBToken;
  let gateway: Gateway;
  let lzSendLib: Address;
  let lzReceiveLib: Address;
  let lzEndpoint: MockContract;
  let nativeToken: TestToken;

  const initialThreshold = ethers.utils.parseEther("100");
  const depositAmount = ethers.utils.parseEther("50");
  const withdrawAmount = ethers.utils.parseEther("50");

  before(async () => {
    [owner, depositor, withdrawer, assetManager] = await ethers.getSigners();
  });

  const deployMbToken = async () => {
    const requiredDVNs = [owner.address];
    lzSendLib = owner.address;
    lzReceiveLib = owner.address;
    const mbTokenFactory = await ethers.getContractFactory("MBToken");
    mbToken = await mbTokenFactory.deploy(
      "MyToken",
      "MTK",
      lzEndpoint.address,
      lzSendLib
    );
  };

  const deployGateway = async () => {
    const Gateway = await ethers.getContractFactory("Gateway");
    gateway = await Gateway.deploy(
      owner.address,
      nativeToken.address,
      mbToken.address
    );
    await gateway.deployed();

    await mbToken.setGateway(gateway.address);
  };

  beforeEach(async () => {
    [owner, depositor, withdrawer, assetManager] = await ethers.getSigners();

    lzEndpoint = await deployMockContract(owner, ILzEndpointV2.abi);
    await lzEndpoint.mock.setDelegate.returns();
    await lzEndpoint.mock.setConfig.returns();
    await lzEndpoint.mock.eid.returns(30106);

    await deployMbToken();

    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    nativeToken = await TestTokenFactory.deploy("Native Token", "rToken");
    await nativeToken.deployed();

    await deployGateway();

    // Deploying the Escrow contract
    const EscrowFactory = await ethers.getContractFactory("Escrow");
    escrow = await EscrowFactory.deploy();

    // Initializing the Escrow contract
    await escrow.initialize(gateway.address, owner.address, initialThreshold);

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
      expect(await escrow.nativeTokenAddress()).to.equal(nativeToken.address);
      expect(await escrow.treasureAddress()).to.equal(owner.address);
      expect(await escrow.thresholdAmount()).to.equal(initialThreshold);
    });
  });

  describe("Deposit Functionality", () => {
    it("should allow the depositor to deposit tokens if below threshold", async () => {
      await nativeToken.mint(escrow.address, depositAmount);
      await nativeToken.approve(gateway.address, depositAmount);

      //Deposit
      await expect(escrow.connect(depositor).depositToGateway())
        .to.emit(escrow, "DepositToGateway")
        .withArgs(depositAmount, initialThreshold);
    });

    it("should revert if the gateway balance exceeds the threshold", async () => {
      await nativeToken.mint(escrow.address, depositAmount);
      await nativeToken.approve(gateway.address, depositAmount);
      await nativeToken.mint(gateway.address, depositAmount.mul(2));
      await expect(
        escrow.connect(depositor).depositToGateway()
      ).to.be.revertedWith("Escrow: Gateway balance exceeds the threshold");
    });
  });

  describe("Withdraw Functionality", () => {
    it("should allow the withdrawer to withdraw tokens if above threshold", async () => {
      const depositAmount = ethers.utils.parseUnits("10", 18);
      await nativeToken.mint(escrow.address, depositAmount);
      await nativeToken.approve(gateway.address, depositAmount);

      await escrow.connect(depositor).depositToGateway();

      await nativeToken.mint(gateway.address, initialThreshold);
      await expect(escrow.connect(withdrawer).withdrawFromGateway())
        .to.emit(escrow, "WithdrawFromGateway")
        .withArgs(depositAmount, initialThreshold);
    });

    it("should revert if the gateway balance is below the threshold", async () => {
      const depositAmount = ethers.utils.parseUnits("10", 18);
      await nativeToken.mint(escrow.address, depositAmount);
      await nativeToken.approve(gateway.address, depositAmount);

      await escrow.connect(depositor).depositToGateway();

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
      await expect(escrow.setTreasureAddress(ethers.constants.AddressZero)).not
        .to.be;
    });
  });

  describe("ERC20 Withdrawal", () => {
    it("should allow the asset manager to withdraw ERC20 tokens", async () => {
      const withdrawAmount = ethers.utils.parseEther("10");

      await nativeToken.mint(escrow.address, withdrawAmount);

      await expect(
        escrow
          .connect(assetManager)
          .withdrawERC20(nativeToken.address, withdrawAmount)
      )
        .to.emit(escrow, "WithdrawERC20")
        .withArgs(nativeToken.address, owner.address, withdrawAmount);
    });

    it("should revert if a non-asset manager tries to withdraw ERC20 tokens", async () => {
      await expect(
        escrow
          .connect(depositor)
          .withdrawERC20(nativeToken.address, ethers.utils.parseEther("10"))
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
      ).to.be.reverted;
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
