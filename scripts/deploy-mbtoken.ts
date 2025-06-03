import hre, { ethers } from "hardhat";

async function deployGatewayContract() {
  const params = [
    "MetaSymemeio",
    "mbSYME",
  ];

  // const gateway = await ethers.deployContract("Gateway", params);

  // await gateway.deployed();

  // console.log("Gateway deployed at:", gateway.address);

  try {
    await hre.run("verify:verify", {
      address: "0x352946E9D37E627f7f3399Cf1E4C979804E99A73",
      constructorArguments: params,
      contract: "contracts/MBToken.sol:MBToken"
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
