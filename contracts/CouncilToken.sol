// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "./Council.sol";

contract CouncilToken is ERC20, ERC20Permit, ERC20Votes {
    bool private _initialized = false;

    constructor() ERC20("CouncilToken", "CTK") ERC20Permit("CouncilToken") {}

    function initialize(Council councilContract) public {
        require(_initialized == false);
        _initialized = true;
        _mint(address(councilContract), 1_000_000);
    }

    function decimals() public view virtual override returns (uint8) {
        return 0;
    }

    // The functions below are overrides required by Solidity.

    function _afterTokenTransfer(address from, address to, uint256 amount)
    internal
    override(ERC20, ERC20Votes)
    {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
    internal
    override(ERC20, ERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
    internal
    override(ERC20, ERC20Votes)
    {
        super._burn(account, amount);
    }
}