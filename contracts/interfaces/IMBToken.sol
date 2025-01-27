// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILayerZeroEndpointV2} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppCore.sol";
import {MessagingFee, SendParam, IOFT} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

interface IMBToken is IOFT, IERC20 {
    function mint(address to, uint256 amount) external;

    function burnFrom(address from, uint256 amount) external;

    function gateway() external returns (address);
}
