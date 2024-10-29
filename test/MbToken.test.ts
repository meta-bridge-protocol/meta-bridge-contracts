const { expect } = require("chai");
const { ethers } = require("hardhat");

import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import { Gateway, MBToken, TestToken } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Address } from "hardhat-deploy/types";
const ILzEndpointV2 = require("../artifacts/contracts/interfaces/ILzEndpointV2.sol/ILzEndpointV2.json");

describe("MBToken Contract", function () {
  let mbToken: MBToken;
  let nativeToken: TestToken;
  let owner: SignerWithAddress,
    minter: SignerWithAddress,
    gateway: Gateway,
    layerZeroEndpoint: MockContract,
    lzSendLib: Address,
    lzReceiveLib: Address;

  before(async function () {
    [owner, minter] = await ethers.getSigners();

    layerZeroEndpoint = await deployMockContract(owner, ILzEndpointV2.abi);

    await layerZeroEndpoint.mock.setDelegate.returns();

    await layerZeroEndpoint.mock.setConfig.returns();

    await layerZeroEndpoint.mock.eid.returns(1);
    lzSendLib = owner.address;
    lzReceiveLib = owner.address;

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

    const gatewayFactory = await ethers.getContractFactory("Gateway");

    gateway = await gatewayFactory.deploy(
      owner.address,
      nativeToken.address,
      mbToken.address
    );

    await mbToken.grantRole(await mbToken.MINTER_ROLE(), minter.address);
  });

  it("should not mint if gateway is not added", async () => {
    const amount = ethers.utils.parseUnits("100", 18);
    await expect(
      mbToken.connect(minter).mint(owner.address, amount)
    ).to.be.revertedWith("Gateway is not set");
  });

  it("should set gateway successfully", async () => {
    await expect(mbToken.connect(owner).setGateway(gateway.address)).not.to.be
      .reverted;
  });

  it("Should revert if non-owner tries to set gateway", async () => {
    await expect(mbToken.connect(minter).setGateway(gateway.address)).to.be
      .reverted;
  });

  it("Should mint tokens correctly", async function () {
    const amount = ethers.utils.parseUnits("100", 18);
    await mbToken.connect(minter).mint(owner.address, amount);
    expect(await mbToken.balanceOf(owner.address)).to.equal(amount);
  });

  it("Should revert if non-minter tries to mint tokens", async function () {
    const amount = ethers.utils.parseUnits("50", 18);

    await expect(mbToken.connect(owner).mint(owner.address, amount)).to.be
      .reverted;
  });

  it("Should set gateway correctly", async function () {
    await mbToken.setGateway(gateway.address);
    expect(await mbToken.gateway()).to.equal(gateway.address);
  });

  it("Should revert if trying to set zero address as gateway", async function () {
    await expect(
      mbToken.setGateway(ethers.constants.AddressZero)
    ).to.be.revertedWith("Zero address");
  });
});
