const { expect } = require("chai");
const { ethers } = require("hardhat");

import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import { Gateway, MBToken, TestToken } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const ILzEndpointV2 = require("../artifacts/contracts/interfaces/ILzEndpointV2.sol/ILzEndpointV2.json");

describe("MBToken Contract", function () {
  let mbToken: MBToken;
  let nativeToken: TestToken;
  let owner: SignerWithAddress;
  let lzReceiveLib: SignerWithAddress;
  let lzSendLib: SignerWithAddress;
  let user: SignerWithAddress,
    minter: SignerWithAddress,
    gateway: Gateway,
    layerZeroEndpoint: MockContract;

  before(async function () {
    [owner, minter, user, lzReceiveLib, lzSendLib] = await ethers.getSigners();

    layerZeroEndpoint = await deployMockContract(owner, ILzEndpointV2.abi);

    await layerZeroEndpoint.mock.quote.returns([
      ethers.BigNumber.from(0),
      ethers.utils.parseUnits("0.000001", 18),
    ]);

    await layerZeroEndpoint.mock.setDelegate.returns();

    await layerZeroEndpoint.mock.setConfig.returns();

    await layerZeroEndpoint.mock.eid.returns(30106);

    // lzReceiveLib = owner.address;

    const mbTokenFactory = await ethers.getContractFactory("MBToken");

    mbToken = await mbTokenFactory.deploy(
      "MyToken",
      "MTK",
      layerZeroEndpoint.address,
      owner.address
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

  it("Check gateway tokens addresses", async () => {
    expect(await gateway.connect(owner).mbToken()).to.equal(mbToken.address);
    expect(await gateway.connect(owner).nativeToken()).to.equal(
      nativeToken.address
    );
  });

  it("should not mint if gateway is not added", async () => {
    const amount = ethers.utils.parseUnits("100", 18);
    await expect(
      mbToken.connect(minter).mint(user.address, amount)
    ).to.be.revertedWith("Gateway is not set");
  });

  it("Should revert if non-owner tries to set gateway", async () => {
    await expect(mbToken.connect(minter).setGateway(gateway.address)).to.be
      .reverted;
  });

  it("Owner should set gateway successfully", async function () {
    const zeroAddress = ethers.constants.AddressZero;
    expect(await mbToken.connect(owner).gateway()).to.equal(zeroAddress);
    await mbToken.connect(owner).setGateway(gateway.address);
    expect(await mbToken.gateway()).to.equal(gateway.address);
  });

  it("Minter Should mint tokens correctly", async function () {
    const amount = ethers.utils.parseUnits("100", 18);
    //check user balance and total supply before mint
    expect(await mbToken.totalSupply()).to.equal(0);
    expect(await mbToken.connect(user).balanceOf(user.address)).to.equal(0);
    //mint
    await mbToken.connect(minter).mint(user.address, amount);
    //check user balance and total supply after mint
    expect(await mbToken.balanceOf(user.address)).to.equal(amount);
    expect(await mbToken.totalSupply()).to.equal(amount);
    //more mint
    await mbToken.connect(minter).mint(user.address, amount);
    expect(await mbToken.balanceOf(user.address)).to.equal(amount.mul(2));
    expect(await mbToken.totalSupply()).to.equal(amount.mul(2));
  });

  it("Should revert if non-minter tries to mint tokens", async function () {
    const amount = ethers.utils.parseUnits("50", 18);
    await expect(mbToken.connect(user).mint(owner.address, amount)).to.be
      .reverted;
  });

  it("Should revert if trying to set zero address as gateway", async function () {
    await expect(
      mbToken.setGateway(ethers.constants.AddressZero)
    ).to.be.revertedWith("Zero address");
  });

  // it("Should correctly process message with sufficient balance", async function () {
  //   const amountSD = ethers.utils.parseUnits("100", 18);
  //   const amountLD = ethers.utils.parseUnits("100", 18);
  //   const guid = ethers.utils.formatBytes32String("test-guid");

  //   const origin = {
  //     srcEid: 30106,
  //     sender: owner.address,
  //     nonce: 0,
  //   };

  //   const encodedMessage = ethers.utils.defaultAbiCoder.encode(
  //     ["address", "uint256"],
  //     [owner.address, amountSD]
  //   );

  //   expect(await nativeToken.balanceOf(owner.address)).to.equal(0);
  //   await nativeToken.mint(owner.address, amountLD);
  //   expect(await nativeToken.balanceOf(owner.address)).to.equal(amountLD);

  //   await nativeToken.transfer(gateway.address, amountLD);
  //   expect(await nativeToken.balanceOf(gateway.address)).to.equal(amountLD);

  //   await mbToken.setGateway(gateway.address);

  //   await expect(
  //     mbToken.lzReceive(origin, guid, encodedMessage, user.address, "0x")
  //   )
  //     .to.emit(mbToken, "OFTReceived")
  //     .withArgs(guid, origin.srcEid, user.address, amountLD);

  //   expect(await nativeToken.balanceOf(user.address)).to.equal(amountLD);
  // });
});
