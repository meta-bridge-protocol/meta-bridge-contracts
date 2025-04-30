// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IGateway {
    function withdraw(
        uint256 realTokenAmount,
        uint256 bridgedTokenAmount
    ) external;

    function deposit(uint256 realTokenAmount) external;

    function nativeToken() external view returns (address);

    function mbToken() external view returns (address);
}

/// @notice The modified Escrow contract to work with Gateway
contract Escrow is Initializable, AccessControlEnumerableUpgradeable {
    address public gatewayAddress;
    address public nativeTokenAddress;
    address public treasuryAddress; // address of treasury to send withdrawn tokens
    /**
     * @notice Demonstrates the threshold amount of Gateway
     * While depositing to the Gateway and withdrawing from it, the threshold amount will specify
     * how many tokens should be deposited or withdrawn
     */
    uint256 public thresholdAmount;
    uint256 public periodLength; // defines the period length
    uint256 public periodStart; // indicates the beginning of the period
    uint256 public periodMaxAmount; // how many tokens can be transferred to the Gateway per period
    uint256 public periodDepositedAmount; // counter: counts the numnber of native tokens transferred in this period

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");
    bytes32 public constant ASSET_MANAGER_ROLE =
        keccak256("ASSET_MANAGER_ROLE");

    event DepositToGateway(uint256 amount, uint256 thresholdAmount);
    event WithdrawFromGateway(uint256 amount, uint256 thresholdAmount);
    event TreasureChanged(address oldTreasure, address newTreasure);
    event WithdrawERC20(address token, address to, uint256 amount);

    function initialize(
        address _gatewayAddress,
        address _treasuryAddress,
        uint256 _thresholdAmount
    ) public initializer {
        __AccessControl_init();

        gatewayAddress = _gatewayAddress;
        treasuryAddress = _treasuryAddress;
        thresholdAmount = _thresholdAmount;

        nativeTokenAddress = IGateway(gatewayAddress).nativeToken();

        periodStart = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function depositToGateway() external onlyRole(DEPOSITOR_ROLE) {
        uint256 gatewayBalance = IERC20(nativeTokenAddress).balanceOf(
            gatewayAddress
        );
        require(
            gatewayBalance < thresholdAmount,
            "Escrow: Gateway balance exceeds the threshold"
        );

        uint256 requiredAmount = thresholdAmount - gatewayBalance;
        uint256 escrowBalance = IERC20(nativeTokenAddress).balanceOf(
            address(this)
        );
        uint256 amount = requiredAmount < escrowBalance
            ? requiredAmount
            : escrowBalance;

        checkLimits(amount);

        IERC20(nativeTokenAddress).approve(gatewayAddress, amount);
        IGateway(gatewayAddress).deposit(amount);

        emit DepositToGateway(amount, thresholdAmount);
    }

    function withdrawFromGateway() external onlyRole(WITHDRAWER_ROLE) {
        uint256 gatewayBalance = IERC20(nativeTokenAddress).balanceOf(
            gatewayAddress
        );
        require(
            gatewayBalance > thresholdAmount,
            "Escrow: Gateway balance is below the threshold"
        );

        uint256 requiredAmount = gatewayBalance - thresholdAmount;
        IGateway(gatewayAddress).withdraw(requiredAmount, 0);

        emit WithdrawFromGateway(requiredAmount, thresholdAmount);
    }

    /**
     *
     * @param _periodLength Length of the period in seconds
     * @param _periodMaxAmount Max amount that will be transferred to the Gateway in the period
     * It's recommended to set periodMaxAmount greater than threshold amount
     * @param _thresholdAmount Gateway threshold amount
     */
    function config(
        uint256 _periodLength,
        uint256 _periodMaxAmount,
        uint256 _thresholdAmount,
        address _treasuryAddress
    ) external onlyRole(CONFIG_ROLE) {
        periodLength = _periodLength;
        periodMaxAmount = _periodMaxAmount;
        thresholdAmount = _thresholdAmount;
        treasuryAddress = _treasuryAddress;
    }

    function withdrawERC20(
        address token,
        uint256 amount
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        IERC20(token).transfer(treasuryAddress, amount);

        emit WithdrawERC20(token, treasuryAddress, amount);
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

    function checkLimits(uint256 amount) internal {
        if (!hasRole(ADMIN_ROLE, msg.sender)) {
            if (block.timestamp - periodStart <= periodLength) {
                periodDepositedAmount += amount;
                require(
                    periodDepositedAmount <= periodMaxAmount,
                    "Period threshold is exceeded"
                );
            } else {
                periodStart = block.timestamp;
                periodDepositedAmount = amount;
            }
        }
    }
}
