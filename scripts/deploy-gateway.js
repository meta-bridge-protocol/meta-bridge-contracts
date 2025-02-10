import hre, { ethers } from "hardhat";

async function deployGatewayContract() {
  const params = [
    "0x3F85D3F9390b8Aee4292D2D543Cec166B8B55aDD",
    "0x99E7bD153585368c975FcFcdD2cCF0B5172963Ad",
    "0x8D4aE54e70614c21162A0faF1e0273492CC0078a",
  ];

  const gateway = await ethers.deployContract("contracts/Gateway.sol:Gateway", params);

  await gateway.deployed();

  console.log("Gateway deployed at:", gateway.address);

  try {
    await hre.run("verify:verify", {
      address: gateway.address,
      constructorArguments: params,
      contract: "contracts/Gateway.sol:Gateway"
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
