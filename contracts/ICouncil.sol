// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract ICouncil {
    enum Sentiment {
        FOR,
        AGAINST,
        NEUTRAL,
        INFORMATION,
        QUESTION
    }
    event ProposalSeconded(uint256 proposalId, address seconder);
}