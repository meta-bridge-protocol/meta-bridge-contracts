import hre, { ethers } from "hardhat";

async function deployGatewayContract() {
  const params = [
    "1000000000000000000000000",
    "MetaTest",
    "TST",
    "0x88e99a963915E6c87bde66Cf1354bBb806E7454f"
  ];

  try {
    await hre.run("verify:verify", {
      address: "0x8749855e57aA3FD0fB5046E2a1b2409010e53544",
      constructorArguments: params,
      contract: "contracts/NativeToken.sol:NativeToken"
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
