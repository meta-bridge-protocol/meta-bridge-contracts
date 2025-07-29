// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MBToken} from "./MBToken.sol";

contract MetaDEUS is MBToken {
    constructor(address _mbOApp) MBToken("MetaDEUS", "mbDEUS", _mbOApp) {}
}
