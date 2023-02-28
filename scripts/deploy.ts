// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";
import { Contract, ContractFactory } from 'ethers';

async function main(): Promise<void> {
  // Hardhat always runs the compile task when running scripts through it.
  // If this runs in a standalone fashion you may want to call compile manually
  // to make sure everything is compiled
  // await run("compile");
  // We get the contract to deploy

  const tokenFactory = await ethers.getContractFactory("CouncilToken");
  const tokenContract = await tokenFactory.deploy();

  const Council = await ethers.getContractFactory("Council");
  const councilContract = await upgrades.deployProxy(Council, [tokenContract.address]);
  await councilContract.deployed()

  await tokenContract.initialize(councilContract.address);

  console.log('CouncilToken deployed to:', tokenContract.address);
  console.log('CouncilContract deployed to:', councilContract.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
