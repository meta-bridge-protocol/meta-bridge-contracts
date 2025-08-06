// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface INativeToken is IERC20 {
    function mint(address reveiver, uint256 amount) external;

    function maxSupply() external view returns (uint256);
}
