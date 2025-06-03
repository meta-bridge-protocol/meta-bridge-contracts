import hre, { ethers } from "hardhat";

async function deployGatewayContract() {
  const params = [
    "0xb57490CDAABEDb450df33EfCdd93079A24ac5Ce5",
    "0x6649e6E25fE047d4CD1311f1b75C9f5Fc994051E",
    "0xd56dc9fEAcd3341eA3aEE4BCB8526c0B2A1ce8E5",
  ];

  const gateway = await ethers.deployContract("MinterGateway", params);

  await gateway.deployed();

  console.log("Gateway deployed at:", gateway.address);

  try {
    await hre.run("verify:verify", {
      address: gateway.address,
      constructorArguments: params
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
