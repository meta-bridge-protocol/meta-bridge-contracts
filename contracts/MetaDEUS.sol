// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MBToken} from "./MBToken.sol";

contract MetaDEUS is MBToken {
    constructor(
        address _layerZeroEndpoint, // local endpoint address
        address _lzSendLib, // sender MessageLib  address
        address _lzReceiveLib, // receiver MessageLib address
        address[] memory _requiredDVNs, // required DVNs
        address _owner // token owner used as a delegate in LayerZero Endpoint
    )
        MBToken(
            "MetaDEUS",
            "mbDEUS",
            _layerZeroEndpoint,
            _lzSendLib,
            _lzReceiveLib,
            _requiredDVNs,
            _owner
        )
    {}
}
