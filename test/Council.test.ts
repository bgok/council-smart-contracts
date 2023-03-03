import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import snapshotGasCost from "@uniswap/snapshot-gas-cost";
import { keccak256 } from "hardhat/internal/util/keccak";
import { utils } from "ethers";

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

    mine(1)

    return { deployer, member1, member2, nonMember, tokenContract, councilContract };
  }
  describe("Propose", async () => {
    it("member1 and member2 should have a token", async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);
      expect(await tokenContract.balanceOf(member1.address)).to.eq(1);
      expect(await tokenContract.balanceOf(member2.address)).to.eq(1);
      expect(await tokenContract.balanceOf(nonMember.address)).to.eq(0);
      expect(await tokenContract.balanceOf(councilContract.address));


    });

    it("member1 proposes, member2 seconds", async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);

      const proposalText = 'hello council'
      const proposalId = await councilContract.hashProposal([], [], [], keccak256(Buffer.from(proposalText)))
      const cid = '0123456789abcdef'

      await expect(await councilContract.connect(member1).propose([], [], [], proposalText, cid))
        .to.emit(councilContract, 'ProposalCreated')
        .withArgs(
          utils.hexlify(proposalId), member1.address, [], [], [], [], 0, 0, proposalText, cid
        )
      let proposalState = (await councilContract.getProposalById(proposalId)).state;
      expect(proposalState).to.equal(1);

      await expect(councilContract.connect(member2).secondProposal(proposalId))
        .to.emit(councilContract, "ProposalSeconded")
        .withArgs(utils.hexlify(proposalId), member2.address)
      proposalState = (await councilContract.getProposalById(proposalId)).state;
      expect(proposalState).to.equal(2);
    })

    it('rejects proposal from non-member', async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);
      const proposalText = 'hello non-member'
      const cid = 'deadbeef';
      await expect(councilContract.connect(nonMember).propose([], [], [], proposalText, cid))
        .to.be.revertedWith('Voters only')
    })

    it('rejects a second from a non-mmeber', async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);
      const proposalText = 'hello council'
      const cid = 'beefdead'
      const proposalId = await councilContract.hashProposal([], [], [], keccak256(Buffer.from(proposalText)))

      await councilContract.connect(member1).propose([], [], [], proposalText, cid)

      await expect(councilContract.connect(nonMember).secondProposal(proposalId))
        .to.be.rejectedWith('Voters only')
    })
  });
});
