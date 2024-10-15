import hre, { ethers } from "hardhat";

async function deployGatewayContract() {
  const params = [
    "0xF743e0De4C446A44D9124E240f8b642d8571522F",
    "0xDE55B113A27Cc0c5893CAa6Ee1C020b6B46650C0",
    "0x650a795b3b728Df29c252EF49CFD5884b68D8644",
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
