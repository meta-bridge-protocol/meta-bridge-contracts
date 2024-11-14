import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
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
  let treasure: SignerWithAddress;
  let depositor: SignerWithAddress;
  let withdrawer: SignerWithAddress;
  let assetManager: SignerWithAddress;
  let user: SignerWithAddress;
  let mbToken: MBToken;
  let gateway: Gateway;
  let lzSendLib: Address;
  let lzReceiveLib: Address;
  let lzEndpoint: MockContract;
  let nativeToken: TestToken;

  const initialThreshold = ethers.utils.parseEther("100");
  const escrowMintAmount = ethers.utils.parseEther("150");

  before(async () => {
    [owner, depositor, withdrawer, assetManager, user, treasure] =
      await ethers.getSigners();
  });

  const deployMbToken = async () => {
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
    await escrow.initialize(
      gateway.address,
      treasure.address,
      initialThreshold
    );

    // Granting roles
    await escrow.grantRole(await escrow.DEPOSITOR_ROLE(), depositor.address);
    await escrow.grantRole(await escrow.WITHDRAWER_ROLE(), withdrawer.address);
    await escrow.grantRole(
      await escrow.ASSET_MANAGER_ROLE(),
      assetManager.address
    );

    await nativeToken.connect(owner).mint(escrow.address, escrowMintAmount);
    await nativeToken.connect(owner).approve(gateway.address, escrowMintAmount);

    expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(
      escrowMintAmount
    );

    expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(0);
  });

  describe("Deployment", () => {
    it("should set the correct initial parameters", async () => {
      expect(await escrow.nativeTokenAddress()).to.equal(nativeToken.address);
      expect(await escrow.treasureAddress()).to.equal(treasure.address);
      expect(await escrow.thresholdAmount()).to.equal(initialThreshold);
    });
  });

  describe("Deposit Functionality", () => {
    it("should not allow the non-depositor to deposit", async () => {
      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal("0");

      await expect(
        escrow.connect(user).depositToGateway()
      ).to.revertedWithCustomError(escrow, "AccessControlUnauthorizedAccount");

      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(0);
    });

    it("should allow the depositor to deposit tokens if below threshold and required amount less than escrowBalance", async () => {
      const gatewayBalance = await nativeToken.balanceOf(gateway.address);
      expect(gatewayBalance).to.be.equal(0);

      expect(await nativeToken.balanceOf(treasure.address)).to.be.equal(0);

      const escrowBalance = await nativeToken.balanceOf(escrow.address);
      expect(escrowBalance).to.be.equal(escrowMintAmount);

      const requiredAmount = initialThreshold.sub(gatewayBalance);

      expect(requiredAmount).lt(escrowBalance);

      expect(await gateway.deposits(escrow.address)).to.be.equal(0);

      await expect(escrow.connect(depositor).depositToGateway())
        .to.emit(escrow, "DepositToGateway")
        .withArgs(requiredAmount, initialThreshold);

      expect(await gateway.deposits(escrow.address)).to.be.equal(
        requiredAmount
      );

      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(
        escrowBalance.sub(requiredAmount)
      );

      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        requiredAmount
      );

      expect(await nativeToken.balanceOf(treasure.address)).to.be.equal(0);
    });

    it("should allow the depositor to deposit tokens if below threshold and escrowBalance less than required amount", async () => {
      const withdrawAmount = ethers.utils.parseEther("100");
      const gatewayBalance = await nativeToken.balanceOf(gateway.address);
      expect(gatewayBalance).to.be.equal(0);

      expect(await nativeToken.balanceOf(treasure.address)).to.be.equal(0);

      let escrowBalance = await nativeToken.balanceOf(escrow.address);
      expect(escrowBalance).to.be.equal(escrowMintAmount);

      await escrow
        .connect(assetManager)
        .withdrawERC20(nativeToken.address, withdrawAmount);

      escrowBalance = await nativeToken.balanceOf(escrow.address);
      expect(escrowBalance).to.be.equal(escrowMintAmount.sub(withdrawAmount));

      const requiredAmount = initialThreshold.sub(gatewayBalance);

      expect(escrowBalance).lt(requiredAmount);

      expect(await gateway.deposits(escrow.address)).to.be.equal(0);

      await expect(escrow.connect(depositor).depositToGateway())
        .to.emit(escrow, "DepositToGateway")
        .withArgs(escrowBalance, initialThreshold);

      expect(await gateway.deposits(escrow.address)).to.be.equal(escrowBalance);

      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(0);

      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        escrowBalance
      );
      expect(await nativeToken.balanceOf(treasure.address)).to.be.equal(
        withdrawAmount
      );
    });

    it("should revert if the gateway balance exceeds the threshold", async () => {
      await nativeToken
        .connect(owner)
        .mint(gateway.address, escrowMintAmount.mul(2));
      await expect(
        escrow.connect(depositor).depositToGateway()
      ).to.be.revertedWith("Escrow: Gateway balance exceeds the threshold");
    });
  });

  describe("Withdraw Functionality", () => {
    let gatewayBalance = null;
    let escrowBalance = null;
    let escrowBalanceAfterDeposit = null;
    let requiredAmount = null;

    beforeEach(async () => {
      gatewayBalance = await nativeToken.balanceOf(gateway.address);
      expect(gatewayBalance).to.be.equal(0);

      expect(await nativeToken.balanceOf(treasure.address)).to.be.equal(0);

      escrowBalance = await nativeToken.balanceOf(escrow.address);
      expect(escrowBalance).to.be.equal(escrowMintAmount);

      requiredAmount = initialThreshold.sub(gatewayBalance);

      expect(requiredAmount).lt(escrowBalance);

      //Deposit to gateway
      await expect(escrow.connect(depositor).depositToGateway())
        .to.emit(escrow, "DepositToGateway")
        .withArgs(requiredAmount, initialThreshold);

      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(
        escrowBalance.sub(requiredAmount)
      );

      escrowBalanceAfterDeposit = await nativeToken.balanceOf(escrow.address);

      expect(await nativeToken.balanceOf(gateway.address)).to.be.equal(
        requiredAmount
      );
    });

    it("should not allow the withdrawer to withdraw tokens", async () => {
      await expect(
        escrow.connect(user).withdrawFromGateway()
      ).to.be.revertedWithCustomError(
        escrow,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should allow the withdrawer to withdraw tokens if above threshold", async () => {
      await nativeToken.connect(owner).mint(gateway.address, initialThreshold);

      gatewayBalance = await nativeToken.balanceOf(gateway.address);

      expect(gatewayBalance).to.be.equal(requiredAmount.add(initialThreshold));

      expect(await gateway.deposits(escrow.address)).to.be.equal(
        requiredAmount
      );

      expect(await nativeToken.balanceOf(treasure.address)).to.be.equal(0);

      const withdrawerRequiredAmount = gatewayBalance.sub(initialThreshold);
      await expect(escrow.connect(withdrawer).withdrawFromGateway())
        .to.emit(escrow, "WithdrawFromGateway")
        .withArgs(withdrawerRequiredAmount, initialThreshold);

      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(
        escrowBalanceAfterDeposit.add(withdrawerRequiredAmount)
      );

      expect(await gateway.deposits(escrow.address)).to.be.equal(
        requiredAmount.sub(withdrawerRequiredAmount)
      );

      expect(await nativeToken.balanceOf(treasure.address)).to.be.equal(0);
    });

    it("should revert if user(escrow) INSUFFICIENT_USER_BALANCE", async () => {
      await nativeToken
        .connect(owner)
        .mint(gateway.address, initialThreshold.mul(2));
      gatewayBalance = await nativeToken.balanceOf(gateway.address);

      const escrowDepositBalance = await gateway.deposits(escrow.address);

      expect(escrowDepositBalance).lt(gatewayBalance);

      await expect(
        escrow.connect(withdrawer).withdrawFromGateway()
      ).to.be.revertedWith("Gateway: INSUFFICIENT_USER_BALANCE");

      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(
        escrowBalanceAfterDeposit
      );
    });

    it("should revert if the gateway balance is below the threshold", async () => {
      await expect(
        escrow.connect(withdrawer).withdrawFromGateway()
      ).to.be.revertedWith("Escrow: Gateway balance is below the threshold");
    });
  });

  describe("Threshold Management", () => {
    const newThreshold = ethers.utils.parseEther("200");
    it("should allow the admin to set a new threshold amount", async () => {
      expect(await escrow.thresholdAmount()).to.equal(initialThreshold);

      await expect(escrow.connect(owner).setThresholdAmount(newThreshold))
        .to.emit(escrow, "SetThresholdAmount")
        .withArgs(newThreshold);

      expect(await escrow.thresholdAmount()).to.equal(newThreshold);
    });

    it("should revert if a non-admin tries to set a new threshold", async () => {
      expect(await escrow.thresholdAmount()).to.equal(initialThreshold);

      await expect(
        escrow.connect(depositor).setThresholdAmount(newThreshold)
      ).to.be.revertedWithCustomError(
        escrow,
        "AccessControlUnauthorizedAccount"
      );

      expect(await escrow.thresholdAmount()).to.equal(initialThreshold);
    });
  });

  describe("Treasure Address Management", () => {
    it("should allow the admin to change the treasure address", async () => {
      const newTreasureAddress = ethers.Wallet.createRandom().address;

      await expect(escrow.connect(owner).setTreasureAddress(newTreasureAddress))
        .to.emit(escrow, "TreasureChanged")
        .withArgs(treasure.address, newTreasureAddress);

      expect(await escrow.treasureAddress()).to.equal(newTreasureAddress);
    });

    it("should revert if a non-admin tries to change the treasure address", async () => {
      const newTreasureAddress = ethers.Wallet.createRandom().address;
      await expect(
        escrow.connect(depositor).setTreasureAddress(newTreasureAddress)
      ).to.be.revertedWithCustomError(
        escrow,
        "AccessControlUnauthorizedAccount"
      );
    });

    //zero address
    it("should revert when setting treasure address to address(0)", async function () {
      await expect(escrow.setTreasureAddress(ethers.constants.AddressZero));
    });
  });

  describe("ERC20 Withdrawal", () => {
    it("should allow the asset manager to withdraw ERC20 tokens", async () => {
      const withdrawAmount = ethers.utils.parseEther("10");

      const treasureBalanceBeforeWithdraw = await nativeToken.balanceOf(
        treasure.address
      );

      expect(treasureBalanceBeforeWithdraw).to.be.equal(0);

      const escrowBalance = await nativeToken.balanceOf(escrow.address);

      expect(escrowBalance).to.be.equal(escrowMintAmount);

      await expect(
        escrow
          .connect(assetManager)
          .withdrawERC20(nativeToken.address, withdrawAmount)
      )
        .to.emit(escrow, "WithdrawERC20")
        .withArgs(nativeToken.address, treasure.address, withdrawAmount);

      expect(await nativeToken.balanceOf(escrow.address)).to.be.equal(
        escrowBalance.sub(withdrawAmount)
      );
      expect(await nativeToken.balanceOf(treasure.address)).to.be.equal(
        treasureBalanceBeforeWithdraw.add(withdrawAmount)
      );
    });

    it("should revert if a non-asset manager tries to withdraw ERC20 tokens", async () => {
      await expect(
        escrow
          .connect(depositor)
          .withdrawERC20(nativeToken.address, ethers.utils.parseEther("10"))
      ).to.be.revertedWithCustomError(
        escrow,
        "AccessControlUnauthorizedAccount"
      );
    });
  });
});
