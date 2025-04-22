// SPDX-License-Identifier: MIT
// This gateway is for all destination chains with the newly deployed mintable-burnable Symemeio
// on the original chain (BASE), we use a different gateway contract, see ... SourceGateway.sol !!FIXME!! ?
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./Symemeio.sol";

/// @title MinterGateway
/// @notice This contract allows users to swap mb tokens to native tokens and vice versa.
/// It will mint native tokens directly and has some additional functionalities like period limit checking.
contract MinterGateway is ReentrancyGuard, AccessControlEnumerable, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");

    address public nativeToken;
    address public mbToken;
    uint256 public periodLength; // defines the period length
    uint256 public periodStart; // indicates the beginning of the period
    uint256 public periodMaxAmount; // how many tokens are convertible per period
    uint256 public periodMintedAmount; // counter: counts the numnber of native tokens minted in this period

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
        _grantRole(CONFIG_ROLE, _admin);

        periodStart = block.timestamp;
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

    /// @notice Pauses the contract.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses the contract.
    function unpause() external onlyRole(UNPAUSER_ROLE) {
        _unpause();
    }

    /**
     * @param _periodLength Length of the period in seconds
     * @param _maxAmount Max swappable amount in the period
     * @param _burnFee The numerator of the fee fraction fee/scale
     * @param _burnFeeScale The denominator of the fee fraction fee/scale
     * @param _treasuryFee The numerator of the fee fraction fee/scale
     * @param _treasuryFeeScale The denominator of the fee fraction fee/scale
     * @param _feeTreasury the address of treasury that fees will be transferred to
     */
    function config(
        uint256 _periodLength,
        uint256 _maxAmount,
        uint32 _burnFee,
        uint32 _burnFeeScale,
        uint32 _treasuryFee,
        uint32 _treasuryFeeScale,
        address _feeTreasury
    ) external onlyRole(CONFIG_ROLE) {
        periodLength = _periodLength;
        periodMaxAmount = _maxAmount;
        burnFee = _burnFee;
        burnFeeScale = _burnFeeScale;
        treasuryFee = _treasuryFee;
        treasuryFeeScale = _treasuryFeeScale;
        feeTreasury = _feeTreasury;
    }

    /**
     *
     * @param amount Amount to be withdrawn
     * @param _to Destination address
     * @param _tokenAddr Address of tokens to be withdrawn. Use address(0) for ether
     * @dev adminWithdraw is typically multi-sig roled, it enables admin to withdraw any amount of
     * either mbToken, native token, or ethers
     * this function is mainly useful if a bridge tech is hacked or halted,
     * and a new solution will be deployed with metabridge
     * (then this gateway is "killed" and replaced with another one;
     * the native tokens must then be withdrawn)
     * note that if the gateway is paused, admins can still withdraw
     */
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

    /**
     * @dev this is the specific implemntation for Symemeio
     * @return The maximum swapable amount (given per period limits -- taking max supply of native token on the chain )
     */
    function swappableAmount() public view returns (uint256) {
        uint256 supply = Symemeio(nativeToken).maxSupply() -
            Symemeio(nativeToken).totalSupply();
        if (periodLength > 0) {
            uint256 result;
            // if the period has not ended yet
            if (block.timestamp - periodStart <= periodLength) {
                result = periodMaxAmount - periodMintedAmount;
            } else {
                result = periodMaxAmount;
            }
            if (supply >= result) {
                return result;
            }
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

        uint256 mbBalance = IERC20(mbToken).balanceOf(address(this));

        IERC20(mbToken).safeTransferFrom(msg.sender, address(this), amount_);

        uint256 receivedAmount = IERC20(mbToken).balanceOf(address(this)) -
            mbBalance;
        require(amount_ == receivedAmount, "Gateway: INVALID_RECEIVED_AMOUNT");

        uint256 maxSwappableAmount = swappableAmount();

        // the number of native tokens minted are equal to the number of mbTokens bridged (and received by the gateway) minus the ( burn fee + treasury fee )
        uint256 burnFeeAmount = _getBurnFeeAmount(amount_);
        uint256 treasuryFeeAmount = _getTreasuryFeeAmount(amount_);

        uint256 netAmount = amount_ - (burnFeeAmount + treasuryFeeAmount);

        // all mbTokens swapped are burned, while the net (after fee) amount of native tokens are minted to the user wallet
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

        // Mint native tokens (treasury fee) to the treasury address
        if (treasuryFeeAmount != 0) {
            Symemeio(nativeToken).mint(feeTreasury, treasuryFeeAmount);
        }
        // Mint native tokens to the user address
        Symemeio(nativeToken).mint(to_, netAmount);

        _checkLimits(netAmount);

        emit TokenSwapped(msg.sender, to_, mbToken, nativeToken, amount_);
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

    /**
     *
     * @param amount swap amount
     * @dev It makes sure that defined limitations are met. The limitations are not applied to the admin
     */
    function _checkLimits(uint256 amount) internal {
        if (!hasRole(ADMIN_ROLE, msg.sender)) {
            if (block.timestamp - periodStart <= periodLength) {
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
