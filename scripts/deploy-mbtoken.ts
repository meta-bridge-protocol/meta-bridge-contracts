import hre, { ethers } from "hardhat";

async function deployGatewayContract() {
  const params = [
    "0xa1373Bc11Ae2Bf43DA5D2B944C8f01D2053FeaCf" // mbOApp
  ];

  const mbToken = await ethers.deployContract("MetaDEUS", params);

  await mbToken.deployed();

  console.log("mbToken deployed at:", mbToken.address);

  try {
    await hre.run("verify:verify", {
      address: mbToken.address,
      constructorArguments: params,
      contract: "contracts/MetaDEUS.sol:MetaDEUS"
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
