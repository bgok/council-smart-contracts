// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract ICouncil {
    enum Sentiment {
        UNDEFINED, // 0
        FOR, // 1
        AGAINST, // 2
        NEUTRAL, // 3
        INFORMATION, // 4
        QUESTION // 5
    }
    event ProposalSeconded(uint256 proposalId, address seconder);
    event CommentEvent(uint256 proposalId, address commenter, uint256 parent, string cid, Sentiment sentiment);
}