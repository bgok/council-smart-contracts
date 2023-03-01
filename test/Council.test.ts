import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import snapshotGasCost from "@uniswap/snapshot-gas-cost";
import { keccak256 } from "hardhat/internal/util/keccak";
import { toUtf8Bytes } from "ethers/lib/utils";

describe("Token", () => {
  async function deployContracts() {
    const [deployer, member1, member2, nonMember] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("CouncilToken");
    const tokenContract = await tokenFactory.deploy();

    const Council = await ethers.getContractFactory("Council");
    const councilContract = await upgrades.deployProxy(Council, [tokenContract.address]);
    await councilContract.deployed()

    const tx = await tokenContract.initialize(councilContract.address);
    await tx.wait()

    await councilContract.grantToFounders([member1.address, member2.address], 1)

    console.log('CouncilToken deployed to:', tokenContract.address);
    console.log('CouncilContract deployed to:', councilContract.address)

    return { deployer, member1, member2, nonMember, tokenContract, councilContract };
  }
  describe("Propose", async () => {
    it("member1 and member2 should have a token", async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);
      expect(await tokenContract.balanceOf(member1.address)).to.eq(1);
      expect(await tokenContract.balanceOf(member2.address)).to.eq(1);
      expect(await tokenContract.balanceOf(nonMember.address)).to.eq(0);
      expect(await tokenContract.balanceOf(councilContract.address))
    });

    it.only("member1 proposes", async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);

      const proposalText = 'hello council'
      const proposalId = await councilContract.hashProposal([], [], [], keccak256(Buffer.from(proposalText)))
      console.log(proposalId)

      await councilContract.attach(member1.address).propose([], [], [], proposalText);
      expect(await councilContract.attach(member2.address).secondProposal(proposalId));
    })
  });
});
