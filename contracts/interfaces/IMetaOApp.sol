// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct MessagingFee {
    uint256 nativeFee;
    uint256 lzTokenFee;
}

interface IMetaOApp {
    function send(
        uint32 _dstEid,
        uint256 _tokenId,
        bytes32 _receiver,
        uint256 _amountLD,
        bytes calldata _options,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable;

    function quoteSend(
        uint32 _dstEid,
        uint256 _tokenId,
        bytes32 _receiver,
        uint256 _amountLD,
        bytes memory _options,
        bool _payInLzToken
    ) external view returns (MessagingFee memory msgFee);
}
