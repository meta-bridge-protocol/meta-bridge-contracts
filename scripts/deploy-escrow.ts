import hre, { ethers, upgrades } from "hardhat";

async function deployEscrowContract() {
  let gateway = "0xCcd1f65346f6CEc7E331184ab16869F145E8383e";
  let msig = "0xF743e0De4C446A44D9124E240f8b642d8571522F";
  let thresholdAmount = "5000000000000000000"; // 200 TOKEN
  let deployer = "0xF743e0De4C446A44D9124E240f8b642d8571522F";
  const factory = await ethers.getContractFactory("Escrow", {
    signer: await ethers.getSigner(deployer),
  });
  const escrow = await upgrades.deployProxy(factory, [
    gateway,
    msig,
    thresholdAmount,
  ]);
  await escrow.waitForDeployment();
  try {
    await hre.run("verify:verify", {
      address: await escrow.getAddress(),
      constructorArguments: [gateway, msig, thresholdAmount],
    });
  } catch {
    console.log("Failed to verify");
  }
  console.log("Escrow deployed at:", await escrow.getAddress());
}

deployEscrowContract()
  .then(() => {
    console.log("done");
  })
  .catch(console.log);
