// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MBToken} from "./MBToken.sol";

contract MetaLUV is MBToken {
    constructor(
        address _layerZeroEndpoint, // local endpoint address
        address _owner // token owner used as a delegate in LayerZero Endpoint
    ) MBToken("MetaLUV", "mbLUV", _layerZeroEndpoint, _owner) {}
}
