import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";

import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import { describe, it, beforeEach } from "mocha";

import { MBToken, Gateway, Symemeio } from "../typechain-types";

const ILzEndpointV2 = require("../artifacts/@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol/ILayerZeroEndpointV2.json");

describe("MbToken", function () {
  let gateway: Gateway;
  let mbToken: MBToken;
  let symemeio: Symemeio;
  let layerZeroEndPoint: MockContract;
  let owner: SignerWithAddress;
  let gatewayAdmin: SignerWithAddress;
  let user: SignerWithAddress;

  let mbTokenMinter: SignerWithAddress;
  let peer: SignerWithAddress;
  let initialPeriodStart: Number;
  const initialMaxSupply = ethers.utils.parseUnits("1000", 18);
  const initialUserMbTokenBalance = ethers.utils.parseUnits("10000", 18);
  const ONE = ethers.utils.parseUnits("1", 18);
  const amountLD = ONE.mul(4000);
  let decimalConversionRate;
  let amountSD;
  const guid = ethers.utils.formatBytes32String("test-guid");
  const origin = { srcEid: 30106, sender: "", nonce: 1 };
  let sender;
  let encodedMessage;
  let lzSigner;

  beforeEach(async function () {
    [owner, user, gatewayAdmin, mbTokenMinter, peer] =
      await ethers.getSigners();

    layerZeroEndPoint = await deployMockContract(owner, ILzEndpointV2.abi);

    await layerZeroEndPoint.mock.quote.returns([
      ethers.BigNumber.from(0),
      ethers.utils.parseUnits("0.000001", 18),
    ]);
    await layerZeroEndPoint.mock.setDelegate.returns();
    await layerZeroEndPoint.mock.setConfig.returns();
    await layerZeroEndPoint.mock.eid.returns(30106);

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

    const gatewayFactory = await ethers.getContractFactory("Gateway");

    gateway = await gatewayFactory.deploy(
      gatewayAdmin.address,
      symemeio.address,
      mbToken.address
    );

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

    decimalConversionRate = await mbToken.decimalConversionRate();

    amountSD = amountLD.div(decimalConversionRate);

    sender = ethers.utils.hexZeroPad(peer.address, 32);

    origin.sender = sender;

    encodedMessage = ethers.utils.solidityPack(
      ["bytes32", "uint64"],
      [ethers.utils.hexZeroPad(user.address, 32), amountSD]
    );

    lzSigner = await ethers.getSigner(layerZeroEndPoint.address);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [layerZeroEndPoint.address],
    });
    await network.provider.send("hardhat_setBalance", [
      layerZeroEndPoint.address,
      ethers.utils.hexlify(ethers.utils.parseUnits("1", 18)),
    ]);
  });

  describe("lzReceive", function () {
    it("Should LZ be able to mint", async function () {
      await mbToken
        .connect(owner)
        .setPeer(30106, ethers.utils.hexZeroPad(peer.address, 32));

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

      expect(await mbToken.balanceOf(user.address)).to.be.equal(
        amountLD.sub(initialMaxSupply)
      );
      expect(await symemeio.balanceOf(user.address)).to.equal(
        amountLD.sub(amountLD.sub(initialMaxSupply))
      );
      expect(await symemeio.totalSupply()).to.equal(
        amountLD.sub(amountLD.sub(initialMaxSupply))
      );
    });

    it("Should not LZ be able to mint if peer is not set", async function () {
      //not set peer
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
      ).to.be.revertedWithCustomError(mbToken, "NoPeer");

      expect(await mbToken.balanceOf(user.address)).to.be.equal(0);
      expect(await symemeio.balanceOf(user.address)).to.equal(0);
      expect(await symemeio.totalSupply()).to.equal(0);
    });

    it("Should not LZ be able to mint invalid endpoint", async function () {
      await mbToken
        .connect(owner)
        .setPeer(30106, ethers.utils.hexZeroPad(peer.address, 32));

      //invalid end point address
      lzSigner = await ethers.getSigner(user.address);
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
      ).to.be.revertedWithCustomError(mbToken, "OnlyEndpoint");
    });

    it("Should not LZ be able to mint with invalid peer sender address", async function () {
      await mbToken
        .connect(owner)
        .setPeer(30106, ethers.utils.hexZeroPad(peer.address, 32));

      //set invalid peer address to sender
      origin.sender = ethers.utils.hexZeroPad(user.address, 32);
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
      ).to.revertedWithCustomError(mbToken, "OnlyPeer");
    });
  });
});
