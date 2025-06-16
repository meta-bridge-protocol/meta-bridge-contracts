// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MBToken} from "./MBToken.sol";

contract MetaDEUS is MBToken {
    constructor(
        address _layerZeroEndpoint, // local endpoint address
        address _owner, // token owner used as a delegate in LayerZero Endpoint
        address _mbOApp
    ) MBToken("MetaDEUS", "mbDEUS", _mbOApp) {}
}
