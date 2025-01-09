// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Gateway
/// @notice This contract allows users to swap mb tokens to native tokens and vice versa.
contract Gateway is ReentrancyGuard, AccessControlEnumerable, Pausable {
    using SafeERC20 for IERC20;

    enum SwapType {
        TO_NATIVE,
        TO_MBTOKEN
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");
    bytes32 public constant ASSET_MANAGER_ROLE = keccak256("ASSET_MANAGER_ROLE");

    address public nativeToken;
    address public mbToken;
    address public treasuryAddress;

    mapping(address => uint256) public deposits;
    uint256 totalDeposit;

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

    /// @notice Event to log the successful deposit of tokens.
    /// @param user The address of the user who deposited.
    /// @param nativeTokenAmount The amount of native tokens deposited.
    event Deposited(address indexed user, uint256 nativeTokenAmount);

    /// @notice Event to log the successful withdrawal of native or mb tokens.
    /// @param user The address of the user who withdrew.
    /// @param nativeTokenAmount The amount of native tokens withdrawn.
    /// @param mbTokenAmount The amount of mb tokens withdrawn.
    event Withdrawn(
        address indexed user,
        uint256 nativeTokenAmount,
        uint256 mbTokenAmount
    );

    /// @notice Event to log the successful treasury address changed.
    /// @param oldTreasury The previous treasury address.
    /// @param newTreasury The new treasury address.
    event TreasuryChanged(address oldTreasury, address newTreasury);

    /// @notice Event to log the successful withdrawal of any ERC20 tokens by asset manager.
    /// @param token The token that withdrawn.
    /// @param to The address that withdrawn tokens transferred to.
    /// @param amount The amount of tokens withdrawn.
    event WithdrawERC20(address token, address to, uint256 amount);

    /// @notice Constructs a new Gateway contract.
    constructor(address _admin, address _nativeToken, address _mbToken, address _treasuryAddress) {
        require(
            _admin != address(0),
            "Gateway: ADMIN_ADDRESS_MUST_BE_NON-ZERO"
        );
        require(
            _treasuryAddress != address(0),
            "Gateway: TREASURY_ADDRESS_MUST_BE_NON-ZERO"
        );

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        nativeToken = _nativeToken;
        mbToken = _mbToken;
        treasuryAddress = _treasuryAddress;
    }

    function setTreasuryAddress(
        address _treasuryAddress
    ) external onlyRole(ADMIN_ROLE) {
        address oldTreasury = treasuryAddress;
        treasuryAddress = _treasuryAddress;

        emit TreasuryChanged(oldTreasury, treasuryAddress);
    }

    /// @notice Swaps a specified amount of mb tokens to native tokens.
    /// @param amount The amount of mb tokens to swap.
    function swapToNative(uint256 amount) external nonReentrant whenNotPaused {
        _swap(amount, msg.sender, SwapType.TO_NATIVE);
    }

    /// @notice Swaps a specified amount of native tokens to mb tokens.
    /// @param amount The amount of native tokens to swap.
    function swapToMBToken(uint256 amount) external nonReentrant whenNotPaused {
        _swap(amount, msg.sender, SwapType.TO_MBTOKEN);
    }

    /// @notice Swaps a specified amount of mb tokens to native tokens.
    /// @param amount The amount of mb tokens to swap.
    /// @param to The recipient address of the native tokens.
    function swapToNativeTo(
        uint256 amount,
        address to
    ) external nonReentrant whenNotPaused {
        _swap(amount, to, SwapType.TO_NATIVE);
    }

    /// @notice Swaps a specified amount of native tokens to mb tokens.
    /// @param amount The amount of native tokens to swap.
    /// @param to The recipient address of the mb tokens.
    function swapToMBTokenTo(
        uint256 amount,
        address to
    ) external nonReentrant whenNotPaused {
        _swap(amount, to, SwapType.TO_MBTOKEN);
    }

    /// @notice Allows users to deposit native tokens.
    /// @param nativeTokenAmount The amount of native tokens to deposit.
    function deposit(
        uint256 nativeTokenAmount
    ) external nonReentrant whenNotPaused onlyRole(DEPOSITOR_ROLE) {
        require(
            nativeTokenAmount > 0,
            "Gateway: TOTAL_DEPOSIT_MUST_BE_GREATER_THAN_0"
        );

        uint256 balance = IERC20(nativeToken).balanceOf(address(this));

        IERC20(nativeToken).safeTransferFrom(
            msg.sender,
            address(this),
            nativeTokenAmount
        );

        uint256 receivedAmount = IERC20(nativeToken).balanceOf(address(this)) -
            balance;
        require(
            nativeTokenAmount == receivedAmount,
            "Gateway: INVALID_RECEIVED_AMOUNT"
        );

        deposits[msg.sender] += nativeTokenAmount;
        totalDeposit += nativeTokenAmount;

        emit Deposited(msg.sender, nativeTokenAmount);
    }

    /// @notice Allows users to withdraw both native tokens and mb tokens.
    /// @param nativeTokenAmount The amount of native tokens to withdraw.
    /// @param mbTokenAmount The amount of mb tokens to withdraw.
    function withdraw(
        uint256 nativeTokenAmount,
        uint256 mbTokenAmount
    ) external nonReentrant whenNotPaused {
        uint256 totalWithdrawal = nativeTokenAmount + mbTokenAmount;
        require(
            totalWithdrawal > 0,
            "Gateway: TOTAL_WITHDRAWAL_MUST_BE_GREATER_THAN_0"
        );
        require(
            deposits[msg.sender] >= totalWithdrawal,
            "Gateway: INSUFFICIENT_USER_BALANCE"
        );

        deposits[msg.sender] -= totalWithdrawal;
        totalDeposit -= totalWithdrawal;
        if (nativeTokenAmount > 0) {
            IERC20(nativeToken).safeTransfer(msg.sender, nativeTokenAmount);
        }
        if (mbTokenAmount > 0) {
            IERC20(mbToken).safeTransfer(msg.sender, mbTokenAmount);
        }

        emit Withdrawn(msg.sender, nativeTokenAmount, mbTokenAmount);
    }

    /// @notice Pauses the contract.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses the contract.
    function unpause() external onlyRole(UNPAUSER_ROLE) {
        _unpause();
    }

    /// @dev Internal function to handle the token swap.
    /// @param amount_ The amount of tokens to swap.
    /// @param to_ The recipient address of the swapped tokens.
    /// @param type_ The swap type (TO_NATIVE or TO_MBTOKEN).
    function _swap(uint256 amount_, address to_, SwapType type_) internal {
        require(amount_ > 0, "Gateway: AMOUNT_MUST_BE_GREATER_THAN_0");
        require(
            to_ != address(0),
            "Gateway: RECIPIENT_ADDRESS_MUST_BE_NON-ZERO"
        );

        address fromToken;
        address toToken;
        if (type_ == SwapType.TO_MBTOKEN) {
            fromToken = nativeToken;
            toToken = mbToken;
        } else if (type_ == SwapType.TO_NATIVE) {
            fromToken = mbToken;
            toToken = nativeToken;
        } else {
            revert("Invalid SwapType");
        }

        uint256 balance = IERC20(fromToken).balanceOf(address(this));

        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amount_);

        uint256 receivedAmount = IERC20(fromToken).balanceOf(address(this)) -
            balance;
        require(amount_ == receivedAmount, "Gateway: INVALID_RECEIVED_AMOUNT");

        IERC20(toToken).safeTransfer(to_, amount_);

        emit TokenSwapped(msg.sender, to_, fromToken, toToken, amount_);
    }

    /// @notice Withdraw ERC20 tokens from the contract and transfer them to the treasury.
    /// @param token the token address to withdraw.
    /// @param amount the amount of tokens to withdraw.
    function withdrawERC20(address token, uint256 amount) external onlyRole(ASSET_MANAGER_ROLE) {
        if (token == nativeToken || token == mbToken) {
            uint256 gatewayBalance = IERC20(nativeToken).balanceOf(address(this)) +
                IERC20(mbToken).balanceOf(address(this));
            uint256 surplusBalance = gatewayBalance - totalDeposit;
            require(amount <= surplusBalance, "Gateway: REQUESTED_AMOUNT_EXCEEDS_SURPLUS_BALANCE");
        }
        IERC20(token).safeTransfer(treasuryAddress, amount);
        emit WithdrawERC20(token, treasuryAddress, amount);
    }
}
