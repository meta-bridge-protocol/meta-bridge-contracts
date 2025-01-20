import hre, { ethers } from "hardhat";

async function deployGatewayContract() {
  const params = [
    "0x3F85D3F9390b8Aee4292D2D543Cec166B8B55aDD",
    "0xe094C430903C3Fe539D639123e94cE06D1feCB4d",
    "0x8D4aE54e70614c21162A0faF1e0273492CC0078a",
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
