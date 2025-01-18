const { expect } = require("chai");
const { ethers, network } = require("hardhat");

import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import { Gateway, MBToken, TestToken } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const ILzEndpointV2 = require("../artifacts/contracts/interfaces/ILzEndpointV2.sol/ILzEndpointV2.json");

describe("MBToken Contract", function () {
  const ONE = ethers.utils.parseUnits("1", 18);

  let mbToken: MBToken;
  let nativeToken: TestToken;
  let owner: SignerWithAddress;
  let lzReceiveLib: SignerWithAddress;
  let lzSendLib: SignerWithAddress;
  let peer: SignerWithAddress;
  let treasury: SignerWithAddress;
  let user: SignerWithAddress,
    minter: SignerWithAddress,
    gateway: Gateway,
    layerZeroEndpoint: MockContract;

  before(async () => {
    [owner, minter, user, lzReceiveLib, lzSendLib, peer, treasury] =
      await ethers.getSigners();
  });

  beforeEach(async function () {
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
      mbToken.address,
      treasury.address
    );

    await mbToken
      .connect(owner)
      .setPeer(30106, ethers.utils.hexZeroPad(peer.address, 32));
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
    await mbToken.connect(owner).setGateway(gateway.address);
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

  it("Should LZ be able to mint", async function () {
    await mbToken.connect(owner).setGateway(gateway.address);
    const decimalConversionRate = await mbToken.decimalConversionRate();
    const amountLD = ONE.mul(3);
    const amountSD = amountLD.div(decimalConversionRate);

    const guid = ethers.utils.formatBytes32String("test-guid");

    const sender = ethers.utils.hexZeroPad(peer.address, 32);

    const origin = {
      srcEid: 30106,
      sender: sender,
      nonce: 1,
    };

    const encodedMessage = ethers.utils.solidityPack(
      ["bytes32", "uint64"],
      [ethers.utils.hexZeroPad(user.address, 32), amountSD]
    );

    expect(await mbToken.balanceOf(user.address)).to.equal(0);
    expect(await nativeToken.balanceOf(user.address)).to.equal(0);

    const gatewayBalance = amountLD.sub(ONE.mul(1));
    await nativeToken.connect(owner).mint(gateway.address, gatewayBalance);
    expect(await nativeToken.balanceOf(gateway.address)).to.equal(
      gatewayBalance
    );

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [layerZeroEndpoint.address],
    });

    await network.provider.send("hardhat_setBalance", [
      layerZeroEndpoint.address,
      ethers.utils.hexlify(ethers.utils.parseUnits("1", 18)),
    ]);

    const lzSigner = await ethers.getSigner(layerZeroEndpoint.address);

    await expect(
      mbToken
        .connect(lzSigner)
        .lzReceive(
          origin,
          guid,
          encodedMessage,
          ethers.constants.AddressZero,
          "0x"
        )
    )
      .to.emit(mbToken, "OFTReceived")
      .withArgs(guid, origin.srcEid, user.address, amountLD);

    expect(await mbToken.balanceOf(user.address)).to.equal(
      amountLD.sub(gatewayBalance)
    );
    expect(await nativeToken.balanceOf(user.address)).to.equal(gatewayBalance);
    expect(await nativeToken.balanceOf(gateway.address)).to.equal(0);
  });
});
