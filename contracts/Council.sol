// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./governance/GovernorUpgradeable.sol";
import "./governance/extensions/GovernorSettingsUpgradable.sol";
import "./governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "./governance/extensions/GovernorVotesUpgradeable.sol";
import "./governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/TimersUpgradeable.sol";
import "./ICouncil.sol";

contract Council is
    Initializable,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable,
    ICouncil
{
    bool private _foundersGrantCompleted;

    struct Comment {
        string cid;
        uint256 parent; // Parent comment hash, 0 indicates it is a comment directly on the proposal
        uint256 proposal;
        uint256 upvotes;
        uint256 downvotes;
        Sentiment sentiment;
    }

    // TODO make this enumerable
    mapping(uint256 => Comment) public comments;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(IVotesUpgradeable _token) initializer public {
        __Governor_init("Council");
        __GovernorSettings_init(1 /* 1 block */, 50400 /* 1 week */, 0);
        __GovernorCountingSimple_init();
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(4);
        _foundersGrantCompleted = false;
    }

    function grantToFounders(address[] memory foundingMembers, uint256 grantQuantity) public {
        require(!_foundersGrantCompleted, "Founder grant already completed");
        _foundersGrantCompleted = true;
        // Initial token distribution
        for (uint i = 0; i < foundingMembers.length; i++) {
            IERC20(address(token)).transfer(foundingMembers[i], grantQuantity);
        }
    }

    // The following functions are overrides required by Solidity.

    function votingDelay()
    public
    view
    override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
    returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
    public
    view
    override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
    returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
    public
    view
    override(IGovernorUpgradeable, GovernorVotesQuorumFractionUpgradeable)
    returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function proposalThreshold()
    public
    view
    override(GovernorUpgradeable, GovernorSettingsUpgradeable)
    returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _postProposalAction(ProposalCore storage proposal) internal override(GovernorUpgradeable) {
        proposal.state = ProposalState.SecondRequired;
    }

    function secondProposal(uint256 proposalId) onlyVoter public {
        // TODO the proposer should not be able to second the proposal
        ProposalCore memory proposal = getProposalById(proposalId);

        require(proposal.state == ProposalState.SecondRequired);

        _setState(proposalId, ProposalState.InDiscussion);
        emit ProposalSeconded(proposalId, _msgSender());
    }

    function isVoter(address account) virtual internal override returns (bool) {
        return token.balanceOf(account) > 0;
    }

    function commentHash(
        uint256 proposal,
        uint256 parent,
        string memory cid,
        Sentiment sentiment
    ) pure public returns (uint256 hash)
    {
        hash = uint256(keccak256(abi.encode(proposal, parent, cid, sentiment)));
    }

    function addComment(uint256 proposalId, uint256 parent, string memory cid, Sentiment sentiment) onlyVoter public {
        require(getProposalById(proposalId).state == ProposalState.InDiscussion, "unknown proposal or not in-discussion");
        require(parent == 0 || bytes(comments[parent].cid).length != 0, "unknown parent");

        uint256 commentId = commentHash(proposalId, parent, cid, sentiment);
        Comment storage comment = comments[commentId];
        comment.proposal = proposalId;
        comment.parent = parent;
        comment.cid = cid;
        comment.sentiment = sentiment;

        emit CommentEvent(
            proposalId, _msgSender(), parent, cid, sentiment
        );
    }

    function hashAmendment(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        string memory cid
    ) public pure virtual returns (uint256) {
        return uint256(keccak256(abi.encode(proposalId, targets, values, calldatas, description, cid)));
    }

    function proposeAmendment(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        string memory cid
    ) public onlyVoter returns (uint256) {
        require(targets.length == values.length, "Governor: invalid proposal length");
        require(targets.length == calldatas.length, "Governor: invalid proposal length");

        ProposalCore storage proposal = _proposals[proposalId];
        require(proposal.state == ProposalState.InDiscussion, "unknown proposal or not in-discussion");

        uint256 amendmentId = hashAmendment(proposalId, targets, values, calldatas, description, cid);

        ProposalCore storage amendment = _proposals[amendmentId];
        require(amendment.state == ProposalState.Unset, "amendment already exists");

        amendment.state = ProposalState.SecondRequired;
        amendment.cid = cid;

        proposal.state = ProposalState.AmendmentPending;

        emit AmendmentCreated(
            proposalId,
            amendmentId,
            _msgSender(),
            targets,
            values,
            new string[](targets.length),
            calldatas,
            0, //amendment.voteStart.getDeadline(),
            0, //amendment.voteEnd.getDeadline(),
            description,
            cid
        );

        return amendmentId;
    }
}
