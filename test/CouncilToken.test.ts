import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import snapshotGasCost from "@uniswap/snapshot-gas-cost";

describe("Token", () => {
  async function deployContracts() {
    const [deployer, sender, receiver] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("CouncilToken");
    const tokenContract = await tokenFactory.deploy();

    const Council = await ethers.getContractFactory("Council");
    const councilContract = await upgrades.deployProxy(Council, [tokenContract.address]);
    await councilContract.deployed()

    await tokenContract.initialize(councilContract.address);

    return { deployer, sender, receiver, tokenContract, councilContract };
  }
  describe("Mint", async () => {
    it("Should mint some tokens", async () => {
      const { tokenContract, councilContract } = await loadFixture(deployContracts);
      expect(await tokenContract.totalSupply()).to.eq(1_000_000);
      expect(await tokenContract.balanceOf(councilContract.address))
    });
  });
});
