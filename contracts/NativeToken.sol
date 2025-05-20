// SPDX-License-Identifier: MIT
// This token is the newly deployed token on all chains
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract NativeToken is ERC20Burnable, AccessControl {
    uint256 public maxSupply;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @dev MaxSupply has been exceeded.
     */
    error MaxSupplyExceeded(uint256 increasedSupply, uint256 maxSupply);

    constructor(
        uint256 _maxSupply,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        maxSupply = _maxSupply;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function setMaxSupply(uint256 _maxSupply) external onlyRole(ADMIN_ROLE) {
        require(
            maxSupply >= totalSupply(),
            "maxSupply is less than totalSupply"
        );
        maxSupply = _maxSupply;
    }

    /**
     * @dev See {ERC20-_update}.
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        super._update(from, to, value);

        if (from == address(0)) {
            uint256 supply = totalSupply();
            if (supply > maxSupply) {
                revert MaxSupplyExceeded(supply, maxSupply);
            }
        }
    }
}
