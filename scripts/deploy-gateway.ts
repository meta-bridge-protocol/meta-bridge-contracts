import hre, { ethers } from "hardhat";

async function deployGatewayContract() {
  const params = [
    "0xb57490CDAABEDb450df33EfCdd93079A24ac5Ce5",
    "0x9bc6Fe58C5566894420E9c4fbc1CF0cF97DDaCAf",
    "0x352946E9D37E627f7f3399Cf1E4C979804E99A73",
  ];

  // const gateway = await ethers.deployContract("Gateway", params);

  // await gateway.deployed();

  // console.log("Gateway deployed at:", gateway.address);

  try {
    await hre.run("verify:verify", {
      address: "0x175975399814b49351f90Fd35EcC48EaafE498D1",
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
