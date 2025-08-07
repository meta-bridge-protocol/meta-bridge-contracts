import hre, { ethers } from "hardhat";

async function deployGatewayContract() {
  const params = [
    "0xCCf07DC1C9E711414873Bf28CF5D19d0D5d10741", // admin
    "0x99E7bD153585368c975FcFcdD2cCF0B5172963Ad", // nativeToken
    "0x9E97879281e07D9c8a745F07649A49879D1ddC38", // mbToken
  ];

  const gateway = await ethers.deployContract("MinterGateway", params);

  await gateway.deployed();

  console.log("Gateway deployed at:", gateway.address);

  try {
    await hre.run("verify:verify", {
      address: gateway.address,
      constructorArguments: params,
      contract: "contracts/MinterGateway.sol:MinterGateway"
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
