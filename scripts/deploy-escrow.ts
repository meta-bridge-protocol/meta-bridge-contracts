import hre, { ethers, upgrades } from "hardhat";

async function deployEscrowContract() {
  let gateway = "0x20b7244F8f38618aB97De07BAeff270d68eCcC21";
  let msig = "0x7aC46BA21CD4d94C2c74441f77a051951f4b3787";
  let thresholdAmount = "100000000000000000000"; // 100 TOKEN
  let deployer = "0x7aC46BA21CD4d94C2c74441f77a051951f4b3787";
  const factory = await ethers.getContractFactory("Escrow", {
    signer: await ethers.getSigner(deployer),
  });
  const escrow = await upgrades.deployProxy(factory, [
    gateway,
    msig,
    thresholdAmount,
  ]);
  await escrow.deployed();
  try {
    await hre.run("verify:verify", {
      address: escrow.address
    });
  } catch {
    console.log("Failed to verify");
  }
  console.log("Escrow deployed at:", escrow.address);
}

deployEscrowContract()
  .then(() => {
    console.log("done");
  })
  .catch(console.log);
