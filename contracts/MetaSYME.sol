// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MBToken} from "./MBToken.sol";

contract MetaSYME is MBToken {
    constructor(address _mbOApp) MBToken("MetaSYME", "mbSYME", _mbOApp) {}
}
