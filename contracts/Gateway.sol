// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Gateway
/// @notice This contract allows users to swap mb tokens to native tokens and vice versa.
/// It will transfer native tokens to user.
contract Gateway is ReentrancyGuard, AccessControlEnumerable, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");

    address public nativeToken;
    address public mbToken;

    /**
     * @notice % fee that will be burnt ( less native tokens are received than mbtokens )
     * It's used along with burnFeeScale to determine the fee amount that will be burnt
     */
    uint32 public burnFee;

    /**
     * @notice scale number to scale burnFee in decimals
     * burnFee = 2 and burnFeescale = 100 leads to burn 2/100 of swap amount;
     * burnFee = 1 and burnFeescale = 50 also leads to burn 2/100 of swap amount;
     */
    uint32 public burnFeeScale;

    /**
     * @notice % fee that will be tranferred to the treasury ( less native tokens are received than mbtokens )
     * It's used along with treasuryFeeScale to determine the fee amount that will be transferred to the treasury
     */
    uint32 public treasuryFee;

    /**
     * @notice scale number to scale treasuryFee in decimals
     * treasuryFee = 2 and treasuryFeeScale = 100 leads to transfer 2/100 of swap amount to the treasury;
     * treasuryFee = 1 and treasuryFeeScale = 50 also leads to transfer 2/100 of swap amount to the treasury;
     */
    uint32 public treasuryFeeScale;

    address public feeTreasury; // The address of treasury that fees will be transferred to

    mapping(address => uint256) public deposits;

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

    /// @notice Constructs a new Gateway contract.
    constructor(address _admin, address _nativeToken, address _mbToken) {
        require(
            _admin != address(0),
            "Gateway: ADMIN_ADDRESS_MUST_BE_NON-ZERO"
        );

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        nativeToken = _nativeToken;
        mbToken = _mbToken;
        burnFeeScale = 100;
        treasuryFeeScale = 100;
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

    /**
     * @param _burnFee The numerator of the fee fraction fee/scale
     * @param _burnFeeScale The denominator of the fee fraction fee/scale
     * @param _treasuryFee The numerator of the fee fraction fee/scale
     * @param _treasuryFeeScale The denominator of the fee fraction fee/scale
     * @param _feeTreasury the address of treasury that fees will be transferred to
     * @notice Fee amount could have each value with the specified fee and scale
     * e.g. fee 5 and scale 1000 leads to the burn fee 0.5%
     */
    function config(
        uint32 _burnFee,
        uint32 _burnFeeScale,
        uint32 _treasuryFee,
        uint32 _treasuryFeeScale,
        address _feeTreasury
    ) external onlyRole(CONFIG_ROLE) {
        require(_burnFeeScale > 0, "Invalid burnFeeScale");
        require(_treasuryFeeScale > 0, "Invalid treasuryFeeScale");

        burnFee = _burnFee;
        burnFeeScale = _burnFeeScale;
        treasuryFee = _treasuryFee;
        treasuryFeeScale = _treasuryFeeScale;
        feeTreasury = _feeTreasury;
    }

    /**
     *
     * @param swapAmount the amount of swap
     * @dev calculate the fee amount that should be burnt
     */
    function _getBurnFeeAmount(
        uint256 swapAmount
    ) internal view returns (uint256) {
        return (swapAmount * burnFee) / burnFeeScale;
    }

    /**
     *
     * @param swapAmount the amount of swap
     * @dev calculate the fee amount that should be transferred
     */
    function _getTreasuryFeeAmount(
        uint256 swapAmount
    ) internal view returns (uint256) {
        return (swapAmount * treasuryFee) / treasuryFeeScale;
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

        uint256 balance = IERC20(mbToken).balanceOf(address(this));

        IERC20(mbToken).safeTransferFrom(msg.sender, address(this), amount_);

        uint256 receivedAmount = IERC20(mbToken).balanceOf(address(this)) -
            balance;
        require(amount_ == receivedAmount, "Gateway: INVALID_RECEIVED_AMOUNT");

        uint256 maxSwappableAmount = IERC20(nativeToken).balanceOf(
            address(this)
        );

        // the number of native tokens transferred are equal to the number of mbTokens bridged (and received by
        // the gateway) minus the ( burn fee + treasury fee )
        uint256 burnFeeAmount = _getBurnFeeAmount(amount_);
        uint256 treasuryFeeAmount = _getTreasuryFeeAmount(amount_);

        uint256 netAmount = amount_ - (burnFeeAmount + treasuryFeeAmount);

        // all mbTokens swapped are burned,
        // the net (after fee) amount of native tokens are transferred to the user wallet
        // if the net amount is greater than swappable amount,
        // it will swap as much as swappable amount and calculate the new net amount,
        // then it will transfer the remaining mbTokens (amount - swappable amount) to the user
        if (netAmount <= maxSwappableAmount) {
            ERC20Burnable(mbToken).burn(amount_);
        } else {
            /**
             * @dev override fee amounts and net amount based on the max swappable amount
             */
            burnFeeAmount = _getBurnFeeAmount(maxSwappableAmount);
            treasuryFeeAmount = _getTreasuryFeeAmount(maxSwappableAmount);

            netAmount =
                maxSwappableAmount -
                (burnFeeAmount + treasuryFeeAmount);

            ERC20Burnable(mbToken).burn(maxSwappableAmount);

            // Transfer the remaining amount of mbTokens that cannot be swapped to the user
            IERC20(mbToken).safeTransfer(to_, amount_ - maxSwappableAmount);
        }

        if (burnFeeAmount != 0) {
            // Transfer native tokens (burn fee) to the address zero (burn)
            IERC20(nativeToken).transfer(address(0), burnFeeAmount);
        }

        // Transfer native tokens (treasury fee) to the treasury address
        if (treasuryFeeAmount != 0) {
            IERC20(nativeToken).transfer(feeTreasury, treasuryFeeAmount);
        }

        // Transfer the native tokens to the user
        IERC20(nativeToken).safeTransfer(to_, netAmount);

        emit TokenSwapped(msg.sender, to_, mbToken, nativeToken, amount_);
    }

    /**
     * @notice Withdraw tokens from the contract and transfer them to the recipient.
     * @param _amount the amount of token to withdraw.
     * @param _to address of the recipient of tokens
     * @param _tokenAddr address of token to withdraw. Use address(0) for ETH
     */
    function adminWithdraw(
        uint256 _amount,
        address _to,
        address _tokenAddr
    ) external onlyRole(ADMIN_ROLE) {
        require(_to != address(0));
        if (_tokenAddr == address(0)) {
            payable(_to).transfer(_amount);
        } else {
            IERC20(_tokenAddr).transfer(_to, _amount);
        }
    }
}
