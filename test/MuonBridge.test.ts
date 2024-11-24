import { expect, use } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, getChainId } from "hardhat";
import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";

import {
  Gateway,
  MuonBridge,
  MBToken,
  TestToken,
  MuonClient,
} from "../typechain-types";
import { Address } from "hardhat-deploy/types";
import ILzEndpointV2 from "../artifacts/contracts/interfaces/ILzEndpointV2.sol/ILzEndpointV2.json";
import axios from "axios";

describe("MuonBridge", () => {
  const ONE = ethers.utils.parseUnits("1", 18);

  let muon: MuonClient;
  let bridge: MuonBridge;
  let lzEndpoint: MockContract;
  let gateway: Gateway;
  let mbToken: MBToken;
  let nativeToken: TestToken;

  let treasury: SignerWithAddress;
  let admin: SignerWithAddress,
    tokenAdder: SignerWithAddress,
    user: SignerWithAddress;

  const muonAppId =
    "56975517476786865032170849437011357443561067016796421187643956482330466385488";
  const muonPublicKey = {
    x: "0x349ac9e8dc55b13512e3d2303f9772621d576cc746643fb44197f21e19d14235",
    parity: 0,
  };

  const getDummySig = async (
    txId,
    tokenId,
    amount,
    fromChain,
    toChain,
    user
  ) => {
    const response = await axios.get(
      `http://localhost:8000/v1/?app=meta_bridge_test&method=claim&params[txId]=${txId}&params[tokenId]=${tokenId}\
&params[amount]=${amount}&params[fromChain]=${fromChain}&params[toChain]=${toChain}&params[user]=${user}`
    );
    return response.data;
  };

  const claim = async (user, tssSig) => {
    const reqId = tssSig["result"]["reqId"];
    const txId = tssSig["result"]["data"]["signParams"][2]["value"];
    const tokenId = tssSig["result"]["data"]["signParams"][3]["value"];
    const amount = tssSig["result"]["data"]["signParams"][4]["value"];
    const fromChain = tssSig["result"]["data"]["signParams"][5]["value"];
    const toChain = tssSig["result"]["data"]["signParams"][6]["value"];
    const sig = {
      signature: tssSig["result"]["signatures"][0]["signature"],
      owner: tssSig["result"]["signatures"][0]["owner"],
      nonce: tssSig["result"]["data"]["init"]["nonceAddress"],
    };
    await bridge.connect(user).claim(
      user.address, 
      amount, 
      fromChain,
      toChain,
      tokenId,
      txId,
      reqId,
      sig
    )
  };

  before(async () => {
    [admin, tokenAdder, user, treasury] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    lzEndpoint = await deployMockContract(admin, ILzEndpointV2.abi);
    await lzEndpoint.mock.setDelegate.returns();
    await lzEndpoint.mock.setConfig.returns();
    await lzEndpoint.mock.eid.returns(30106);
    await lzEndpoint.mock.quote.returns([
      ethers.BigNumber.from(0),
      ethers.utils.parseUnits("0.000001", 18),
    ]);

    const mbTokenFactory = await ethers.getContractFactory("MBToken");

    mbToken = await mbTokenFactory.connect(admin).deploy(
      "MBToken",
      "mbToken",
      lzEndpoint.address,
      admin.address
    );
    await mbToken.deployed();

    const NativeToken = await ethers.getContractFactory("TestToken");
    nativeToken = await NativeToken.deploy("Native Token", "rToken");
    await nativeToken.deployed();

    await nativeToken.mint(user.address, ONE.mul(100));

    const Gateway = await ethers.getContractFactory("Gateway");
    gateway = await Gateway.deploy(
      admin.address,
      nativeToken.address,
      mbToken.address
    );
    await gateway.deployed();

    await mbToken.connect(admin).setGateway(gateway.address);

    const Muon = await ethers.getContractFactory("MuonClient");
    muon = await Muon.connect(admin).deploy(
      muonAppId,
      muonPublicKey
    );
    await muon.deployed();

    const BridgeFactory = await ethers.getContractFactory("MuonBridge");
    bridge = await BridgeFactory.connect(admin).deploy(
      muonAppId,
      muonPublicKey,
      muon.address
    );
    await bridge
      .connect(admin)
      .grantRole(await bridge.TOKEN_ADDER_ROLE(), tokenAdder.address);

    await mbToken.connect(admin).grantRole(mbToken.MINTER_ROLE(), bridge.address);

    await bridge
      .connect(tokenAdder)
      .addToken(
        1,
        nativeToken.address,
        mbToken.address,
        treasury.address,
        gateway.address,
        true,
        false
      );
  });
  
  describe("Bridge", async function () {
    it("Should bridge successfully", async function () {
      const toChain = 42161;
      expect(await nativeToken.balanceOf(user.address)).eq(ONE.mul(100));
      expect(await nativeToken.balanceOf(bridge.address)).eq(0);
      expect(await bridge.lastTxId()).eq(0);
      await nativeToken.connect(user).approve(bridge.address, ONE.mul(10));
      await bridge.connect(user).send(
        nativeToken.address, 
        toChain, 
        ONE.mul(10),
         0, 
         "0x", 
        {lzTokenFee: 0, nativeFee: 0}
      );
      expect(await nativeToken.balanceOf(user.address)).eq(ONE.mul(100 - 10));
      expect(await nativeToken.balanceOf(treasury.address)).eq(ONE.mul(10));
      expect(await nativeToken.balanceOf(bridge.address)).eq(0);
      expect(await mbToken.balanceOf(bridge.address)).eq(0);
      expect(await mbToken.totalSupply()).eq(0);
      expect(await bridge.lastTxId()).eq(1);
      const lastTx = await bridge.getTx(await bridge.lastTxId());
      expect(lastTx).to.deep.eq([
        await bridge.lastTxId(),
        1,
        ONE.mul(10),
        await getChainId(),
        toChain,
        user.address
      ]);
    });

    it("Should claim successfully", async function () {
      const fromChain = 42161;
      const amount = ONE.mul(10);
      const toChain = await getChainId();
      expect(await nativeToken.balanceOf(user.address)).eq(ONE.mul(100));
      expect(await nativeToken.balanceOf(bridge.address)).eq(0);
      expect(await gateway.nativeToken()).eq(nativeToken.address);
      expect(await nativeToken.balanceOf(gateway.address)).eq(0);
      const sig = await getDummySig(1, 1, amount, fromChain, toChain, user.address);
      await claim(user, sig);
      expect(await nativeToken.balanceOf(user.address)).eq(ONE.mul(100));
      expect(await nativeToken.balanceOf(bridge.address)).eq(0);
      expect(await mbToken.balanceOf(bridge.address)).eq(0);
      expect(await mbToken.balanceOf(user.address)).eq(amount);
      expect(await mbToken.totalSupply()).eq(amount);
      expect(await bridge.lastTxId()).eq(0);
      expect(await bridge.claimedTxs(fromChain, 1)).eq(true);
      expect(await bridge.claimedTxs(fromChain, 2)).eq(false);


      expect(await nativeToken.balanceOf(admin.address)).eq(0);
      await nativeToken.connect(admin).mint(admin.address, ONE.mul(1000));
      expect(await nativeToken.balanceOf(admin.address)).eq(ONE.mul(1000));
      await nativeToken.connect(admin).approve(gateway.address, ONE.mul(1000));
      expect(await nativeToken.balanceOf(gateway.address)).eq(0);

      await gateway.connect(admin).deposit(ONE.mul(300));

      expect(await nativeToken.balanceOf(gateway.address)).eq(ONE.mul(300));
      expect(await nativeToken.balanceOf(admin.address)).eq(ONE.mul(1000 - 300));

      const sig2 = await getDummySig(2, 1, amount, fromChain, toChain, user.address);

      await claim(user, sig2);
      
      expect(await nativeToken.balanceOf(user.address)).eq(ONE.mul(100).add(amount));
      expect(await nativeToken.balanceOf(bridge.address)).eq(0);
      expect(await nativeToken.balanceOf(gateway.address)).eq(ONE.mul(300).sub(amount));
      expect(await mbToken.balanceOf(bridge.address)).eq(0);
      expect(await mbToken.balanceOf(user.address)).eq(amount);
      expect(await mbToken.balanceOf(gateway.address)).eq(amount);
      expect(await mbToken.totalSupply()).eq(amount.mul(2));
      expect(await bridge.lastTxId()).eq(0);
      expect(await bridge.claimedTxs(fromChain, 2)).eq(true);
      
    });
  });
});
