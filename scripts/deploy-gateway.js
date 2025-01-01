import hre, { ethers } from "hardhat";

async function deployGatewayContract() {
  const params = [
    "",
    "",
    "",
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
