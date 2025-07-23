import hre, { ethers, run } from "hardhat";
import { Wallet, providers } from "ethers";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {

  const args = [
    "0x3F92D65Bf086b9c5aebB5F5877b893d692847B7C", // lzBridge
    "0xa1373Bc11Ae2Bf43DA5D2B944C8f01D2053FeaCf" // mbOApp
  ]

  const provider = new providers.JsonRpcProvider(hre.network.config.url)
  const signer = new Wallet(process.env.PRIVATE_KEY, provider);

  const feeData = await ethers.provider.getFeeData();
  const factory = await ethers.getContractFactory("NewTokensDeployer");
  const contract = await factory.deploy(...args, {
    gasLimit: 10_000_000,
    // maxPriorityFeePerGas: feeData.maxPriorityFeePerGas, // tip the miner to execute the transaction
    // maxFeePerGas: feeData.maxFeePerGas, // maxFeePerGas = baseFeePerGas + maxPriorityFeePerGas
    type: 2
  })

  // const contract = await ethers.deployContract("NewTokensDeployer", args, signer);

  await contract.deployed();

  console.log(
    `contract deployed to ${contract.address}`
  );
  
  await sleep(20000);

  await run("verify:verify", {
    address: contract.address,
    constructorArguments: args
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
