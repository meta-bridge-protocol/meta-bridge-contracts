import hre, { ethers } from "hardhat";

async function deployGatewayContract() {
  const params = [
    "0x7aC46BA21CD4d94C2c74441f77a051951f4b3787", // admin
    "0xde5ed76e7c05ec5e4572cfc88d1acea165109e44", // nativeToken
    "0x23164095ed9FC0323152dE1A0A309146D0cE7be4", // mbToken
  ];

  const gateway = await ethers.deployContract("Gateway", params);

  await gateway.deployed();

  console.log("Gateway deployed at:", gateway.address);

  try {
    await hre.run("verify:verify", {
      address: gateway.address,
      constructorArguments: params,
    });
  } catch (e) {
    console.log(e);
    console.log("Failed to verify");
  }
}

deployGatewayContract()
  .then(() => {
    console.log("done");
  })
  .catch(console.log);
