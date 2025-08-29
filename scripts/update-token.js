import hre, { ethers, run } from "hardhat";
import { Wallet, providers } from "ethers";
import fs from "fs/promises";
import path from "path";

async function loadDeployment(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);
    return jsonData;
  } catch (error) {
    console.error(`Error loading JSON from ${filePath}:`, error);
    return null;
  }
}


async function main() {

  const provider = new providers.JsonRpcProvider(hre.network.config.url)
  const signer = new Wallet(process.env.PRIVATE_KEY, provider);

  const parentDir = path.dirname(__dirname);

  const artifact = await loadDeployment(`${parentDir}/artifacts/contracts/LayerZeroBridge.sol/LayerZeroBridge.json`);

  const BRIDGE_ADDR = "0x3F92D65Bf086b9c5aebB5F5877b893d692847B7C";

  const contract = new ethers.Contract(BRIDGE_ADDR, artifact.abi, signer);

  const tx = await contract.updateToken(
    1, // tokenId
    "0xde55b113a27cc0c5893caa6ee1c020b6b46650c0", // nativeToken
    "0x23164095ed9FC0323152dE1A0A309146D0cE7be4", // mbToken
    "0x899d67Bc9825B0cC3B08c55a4De5Cdfd104EefA9", // treasury
    "0x197B7a455737954F4169BCAB22c02AF76096a053", // gateway
    false
  );

  const result = await tx.wait();

  console.log(result);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
