import hre, { ethers, upgrades } from "hardhat";

async function deployEscrowContract() {
  let gateway = "0xb42cf2f220c38466f41dE9e61dB621B7001D52d8";
  let msig = "0xb57490CDAABEDb450df33EfCdd93079A24ac5Ce5";
  let thresholdAmount = "5000000000000000000"; // 200 TOKEN
  let deployer = "0xb57490CDAABEDb450df33EfCdd93079A24ac5Ce5";
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
