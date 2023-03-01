// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./governance/GovernorUpgradeable.sol";
import "./governance/extensions/GovernorSettingsUpgradable.sol";
import "./governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "./governance/extensions/GovernorVotesUpgradeable.sol";
import "./governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Council is
    Initializable,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable
{
    bool private _foundersGrantCompleted;

    modifier onlyVoter() {
        require(getVotes(_msgSender(), block.number - 1) >= 0, 'Voters only');
        _;
    }

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
    }
}
