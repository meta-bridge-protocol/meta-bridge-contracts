import { ethers, upgrades } from "hardhat";

async function main() {
  const v1Address = "0xF32682c93c64FbE98eee23574015A5148fcd1409";
  const contractV1 = await ethers.getContractFactory("contracts/EscrowV1.sol:Escrow");

  const factory = await ethers.getContractFactory("contracts/Escrow.sol:Escrow");

  await upgrades.forceImport(
    v1Address,
    contractV1,
  );

  const contractV2 = await upgrades.upgradeProxy(v1Address, factory);

  console.log("Contract upgraded to:", contractV2.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });