// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./Symemeio.sol";

/// @title Gateway
/// @notice This contract allows users to swap mb tokens to native tokens and vice versa.
contract Gateway is ReentrancyGuard, AccessControlEnumerable, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");

    address public nativeToken;
    address public mbToken;
    uint256 public periodLimit;
    uint256 public periodStart;
    uint256 public periodMaxAmount;
    uint256 public periodMintedAmount;

    /// @notice Event to log the successful token swap.
    /// @param from The address that initiated the swap.
    /// @param to The address that received the swapped tokens.
    /// @param fromToken The address of the token that was swapped.
    /// @param toToken The address of the token that was received.
    /// @param amount The amount of tokens swapped.
    event TokenSwapped(
        address indexed from,
        address to,
        address indexed fromToken,
        address indexed toToken,
        uint256 amount
    );

    /// @notice Constructs a new Gateway contract.
    constructor(address _admin, address _nativeToken, address _mbToken) {
        require(
            _admin != address(0),
            "Gateway: ADMIN_ADDRESS_MUST_BE_NON-ZERO"
        );

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);

        periodStart = block.timestamp;
        nativeToken = _nativeToken;
        mbToken = _mbToken;
    }

    /// @notice Swaps a specified amount of mb tokens to native tokens.
    /// @param amount The amount of mb tokens to swap.
    function swapToNative(uint256 amount) external nonReentrant whenNotPaused {
        _swap(amount, msg.sender);
    }

    /// @notice Swaps a specified amount of mb tokens to native tokens.
    /// @param amount The amount of mb tokens to swap.
    /// @param to The recipient address of the native tokens.
    function swapToNativeTo(
        uint256 amount,
        address to
    ) external nonReentrant whenNotPaused {
        _swap(amount, to);
    }

    /// @notice Pauses the contract.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses the contract.
    function unpause() external onlyRole(UNPAUSER_ROLE) {
        _unpause();
    }

    function setPeriodLimit(
        uint256 _periodLimit
    ) external onlyRole(ADMIN_ROLE) {
        periodLimit = _periodLimit;
    }

    function setPeriodMaxAmount(
        uint256 _maxAmount
    ) external onlyRole(ADMIN_ROLE) {
        periodMaxAmount = _maxAmount;
    }

    function adminWithdraw(
        uint256 amount,
        address _to,
        address _tokenAddr
    ) external onlyRole(ADMIN_ROLE) {
        require(_to != address(0));
        if (_tokenAddr == address(0)) {
            payable(_to).transfer(amount);
        } else {
            IERC20(_tokenAddr).safeTransfer(_to, amount);
        }
    }

    function swappableAmount() public view returns (uint256) {
        uint256 supply = Symemeio(nativeToken).maxSupply() -
            Symemeio(nativeToken).totalSupply();
        uint256 result;
        if (block.timestamp - periodStart <= periodLimit) {
            result = periodMaxAmount - periodMintedAmount;
        } else {
            result = periodMaxAmount;
        }
        if (supply >= result) {
            return result;
        }
        return supply;
    }

    /// @dev Internal function to handle the token swap.
    /// @param amount_ The amount of tokens to swap.
    /// @param to_ The recipient address of the swapped tokens.
    function _swap(uint256 amount_, address to_) internal {
        require(amount_ > 0, "Gateway: AMOUNT_MUST_BE_GREATER_THAN_0");
        require(
            to_ != address(0),
            "Gateway: RECIPIENT_ADDRESS_MUST_BE_NON-ZERO"
        );
        checkLimits(amount_);

        uint256 balance = IERC20(mbToken).balanceOf(address(this));

        IERC20(mbToken).safeTransferFrom(msg.sender, address(this), amount_);

        uint256 receivedAmount = IERC20(mbToken).balanceOf(address(this)) -
            balance;
        require(amount_ == receivedAmount, "Gateway: INVALID_RECEIVED_AMOUNT");

        ERC20Burnable(mbToken).burn(amount_);
        Symemeio(nativeToken).mint(to_, amount_);

        emit TokenSwapped(msg.sender, to_, mbToken, nativeToken, amount_);
    }

    function checkLimits(uint256 amount) internal {
        if (!hasRole(ADMIN_ROLE, msg.sender)) {
            if (block.timestamp - periodStart <= periodLimit) {
                periodMintedAmount += amount;
                require(
                    periodMintedAmount <= periodMaxAmount,
                    "Period threshold is exceeded"
                );
            } else {
                periodStart = block.timestamp;
                periodMintedAmount = amount;
            }
        }
    }
}
