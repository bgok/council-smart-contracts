import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture, mine, mineUpTo } from "@nomicfoundation/hardhat-network-helpers";
import snapshotGasCost from "@uniswap/snapshot-gas-cost";
import { keccak256 } from "hardhat/internal/util/keccak";
import { utils } from "ethers";
import { Council__factory } from "../typechain";
import describe from "node:test";

describe("Token", () => {
  async function deployContracts() {
    const [deployer, member1, member2, nonMember] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("CouncilToken");
    const tokenContract = await tokenFactory.deploy();

    const Council = await ethers.getContractFactory("Council");
    const councilContract = await upgrades.deployProxy(Council, [tokenContract.address]);
    await councilContract.deployed()

    const tx = await tokenContract.initialize(councilContract.address, 50);
    await tx.wait()

    await councilContract.grantToFounders([member1.address, member2.address], 1)
    await tokenContract.connect(member1).delegate(member1.address) // You must delegate to yourself
    await tokenContract.connect(member2).delegate(member2.address)

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

    it('rejects a second from a non-member', async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);
      const proposalText = 'hello council'
      const cid = 'beefdead'
      const proposalId = await councilContract.hashProposal([], [], [], keccak256(Buffer.from(proposalText)))

      await councilContract.connect(member1).propose([], [], [], proposalText, cid)

      await expect(councilContract.connect(nonMember).secondProposal(proposalId))
        .to.be.rejectedWith('Voters only')
    })
  })

  xit('get a list of all proposals', async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);
      const proposalText = 'hello council'
      const cid = 'beefdead'

      for (let i = 0; i <5; i++) {
        await councilContract.connect(member1).propose([], [], [], `${proposalText}-${i}`, `${cid}${i}`)
      }

      // TODO Do this without an argument
      const proposals = await councilContract.proposalIds(/* argument required */);

      expect(proposals.length).to.equal(5);
      console.log(proposals)
    })

  describe('comments', async () => {
    it('add comment', async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);

      const proposalText = 'pump up the volume'
      const cid = '1337'
      const proposalId = await councilContract.hashProposal([], [], [], keccak256(Buffer.from(proposalText)))

      await councilContract.connect(member1).propose([], [], [], proposalText, cid)
      councilContract.connect(member2).secondProposal(proposalId)

      const commentCid = "comment cid";
      const parent = 0;
      const sentiment = 4;
      const commentId = await councilContract.commentHash(proposalId, parent,  commentCid, sentiment)

      await expect(councilContract.connect(member2).addComment(proposalId, parent,  commentCid, sentiment))
        .to.emit(councilContract, 'CommentEvent')
        .withArgs(proposalId, member2.address, parent, commentCid, sentiment)

      const comment = await councilContract.comments(commentId)
      expect(comment.cid).to.equal(commentCid)
      expect(comment.parent).to.equal(parent)
      expect(comment.proposal).to.equal(proposalId)
      expect(comment.upvotes).to.equal(0)
      expect(comment.downvotes).to.equal(0)
      expect(comment.sentiment).to.equal(sentiment)
    })

    it('reject unknown parent comment', async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);

      const proposalText = 'pump up the volume'
      const cid = '1337'
      const proposalId = await councilContract.hashProposal([], [], [], keccak256(Buffer.from(proposalText)))

      await councilContract.connect(member1).propose([], [], [], proposalText, cid)
      councilContract.connect(member2).secondProposal(proposalId)

      const commentCid = "comment cid";
      const parent = 99;
      const sentiment = 4;
      const commentId = await councilContract.commentHash(proposalId, parent,  commentCid, sentiment)

      await expect(councilContract.connect(member2).addComment(proposalId, parent,  commentCid, sentiment))
        .to.be.rejectedWith("unknown parent")
    })

    it('reject comment for unknown proposal', async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);

      const proposalText = 'pump up the volume'
      const cid = '1337'

      await expect(councilContract.connect(member2).addComment(0, 0, 'commentCID', 4))
        .to.be.rejectedWith("unknown proposal or not in-discussion")
    })
    it('reject comment when not in-discussion', async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);

      const proposalText = 'pump up the volume'
      const cid = '1337'
      const proposalId = await councilContract.hashProposal([], [], [], keccak256(Buffer.from(proposalText)))

      await councilContract.connect(member1).propose([], [], [], proposalText, cid)
      await expect(councilContract.connect(member2).addComment(proposalId, 0, 'commentCID', 4))
        .to.be.rejectedWith("unknown proposal or not in-discussion")
    })
  });
  describe('amendment', async () => {
    it('allows voters to propose an amendment', async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);

      const proposalText = 'pump up the volume'
      const cid = '1337'
      const proposalId = await councilContract.hashProposal([], [], [], keccak256(Buffer.from(proposalText)))

      await councilContract.connect(member1).propose([], [], [], proposalText, cid)
      councilContract.connect(member2).secondProposal(proposalId)

      const amendmentCid = "ammendment cid";
      const amendmentDescription = "not too loud, tho"

      const amendmentId = await councilContract.hashAmendment(
        proposalId, [],[], [], amendmentDescription, amendmentCid
      )

      await expect(councilContract.connect(member2).proposeAmendment(
        proposalId, [], [], [], amendmentDescription, amendmentCid
      )).to.emit(councilContract, 'AmendmentCreated')
        .withArgs(proposalId, amendmentId, member2.address, [], [], [], [], 0, 0, amendmentDescription, amendmentCid)

      // Proposal state should be AmendmentPending
      const proposal = await councilContract.getProposalById(proposalId)
      expect(proposal.state).to.equal(3) // AmendmentPending

      // Check that the amendment is set up correctly
      const amendment = await councilContract.getProposalById(amendmentId)
      expect(amendment.state).to.equal(1) // SecondRequired
      expect(amendment.cid).to.equal(amendmentCid)

      await councilContract.connect(member2).secondProposal(amendmentId)
    })
    it('rejects amendments to non-existing propopsals', async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);

      const amendmentCid = "ammendment cid";
      const amendmentDescription = "not too loud, tho"

      await expect(councilContract.connect(member2).proposeAmendment(
        0, [], [], [], amendmentDescription, amendmentCid
      )).to.rejectedWith("unknown proposal or not in-discussion")
    })
  })
  describe("move to vote", async () => {
    it("Allows voter to move to vote", async () => {
      const { member1, member2, nonMember, tokenContract, councilContract } = await loadFixture(deployContracts);

      const proposalText = 'pump up the volume'
      const cid = '1337'
      const proposalId = await councilContract.hashProposal([], [], [], keccak256(Buffer.from(proposalText)))

      await councilContract.connect(member1).propose([], [], [], proposalText, cid)
      councilContract.connect(member2).secondProposal(proposalId)

      await expect(councilContract.connect(member2).moveToVote(proposalId))
        .to.emit(councilContract, "MoveToVoteRequested")
        .withArgs(proposalId, member2.address)

      let proposal = await councilContract.getProposalById(proposalId);
      expect(proposal.state).to.equal(4); // state should be MoveToVotePending
      expect(await councilContract.proposalSnapshot(proposalId)).to.equal(0);
      expect(await councilContract.proposalDeadline(proposalId)).to.equal(0);

      await expect(councilContract.connect(member1).secondProposal(proposalId))
        .to.emit(councilContract, "ProposalSeconded")
        .withArgs(proposalId, member1.address)

      proposal = await councilContract.getProposalById(proposalId);
      expect(proposal.state).to.equal(7); // state should be Active
      expect(await councilContract.proposalSnapshot(proposalId)).to.not.equal(0);
      expect(await councilContract.proposalDeadline(proposalId)).to.not.equal(0);
    })
  })
  describe("vote on proposal", async () => {
    let proposalId:any, member1:any, member2:any, nonMember:any, tokenContract:any, councilContract:any
    beforeEach(async () => {
      const result  = await loadFixture(deployContracts);
      member1 = result.member1
      member2 = result.member2
      nonMember = result.nonMember
      tokenContract =result.tokenContract
      councilContract = result.councilContract

      const proposalText = 'pump up the volume'
      const cid = '1337'
      proposalId = await councilContract.hashProposal([], [], [], keccak256(Buffer.from(proposalText)))

      await councilContract.connect(member1).propose([], [], [], proposalText, cid)
      await councilContract.connect(member2).secondProposal(proposalId)
      await councilContract.connect(member2).moveToVote(proposalId)
      await councilContract.connect(member1).secondProposal(proposalId)
    })
    it("should accept, count votes, and mark proposal SUCCEEDED", async () => {
      const proposal = await councilContract.getProposalById(proposalId)

      await mineUpTo(await councilContract.proposalSnapshot(proposalId))

      await expect(councilContract.connect(member1).castVote(proposalId, 1)) // For
        .to.emit(councilContract, 'VoteCast')
        .withArgs(member1.address, proposalId, 1, 1, '')
      await expect(councilContract.connect(member2).castVote(proposalId, 1)) // For
        .to.emit(councilContract, 'VoteCast')

      await mineUpTo((await councilContract.proposalDeadline(proposalId)).add(1))

      expect(await councilContract.state(proposalId)).to.equal(10) // Succeeded
    })
    it("should accept, count votes, and mark proposal FAILED", async () => {
      const proposal = await councilContract.getProposalById(proposalId)

      await mineUpTo(await councilContract.proposalSnapshot(proposalId))

      await expect(councilContract.connect(member1).castVote(proposalId, 0)) // For
        .to.emit(councilContract, 'VoteCast')
        .withArgs(member1.address, proposalId, 0, 1, '')
      await expect(councilContract.connect(member2).castVote(proposalId, 0)) // For
        .to.emit(councilContract, 'VoteCast')

      await mineUpTo((await councilContract.proposalDeadline(proposalId)).add(1))

      expect(await councilContract.state(proposalId)).to.equal(9) // Succeeded
    })
  })
});
