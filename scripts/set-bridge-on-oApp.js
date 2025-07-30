import hre, { ethers, run } from "hardhat";
import { Wallet, providers } from "ethers";
import fs from "fs/promises";
import path from "path";

async function loadOAppDeployment(filePath) {
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

  const oappConfig = await loadOAppDeployment(`${parentDir}/deployments/${hre.network.name}/MetaOApp.json`);

  const contract = new ethers.Contract(oappConfig.address, oappConfig.abi, signer);

  const tx = await contract.setLzBridge(
    "0x3F92D65Bf086b9c5aebB5F5877b893d692847B7C", // lzBridge
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
