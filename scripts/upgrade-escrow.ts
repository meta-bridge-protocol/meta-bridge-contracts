import { ethers, upgrades } from "hardhat";

async function main() {
  const CONTRACT_ADDRESS = "0xB4C7d1b051c4F498e4D86638De68A43fA8D5a84b";
  const Factory = await ethers.getContractFactory("Escrow");
  const contract = await upgrades.upgradeProxy(CONTRACT_ADDRESS, Factory);
  console.log(`Contract upgraded to ${contract.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });