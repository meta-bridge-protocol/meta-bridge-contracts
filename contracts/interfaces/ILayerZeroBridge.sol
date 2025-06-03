// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILayerZeroBridge {
    struct Token {
        uint256 tokenId;
        address nativeToken;
        address mbToken;
        address treasury;
        address gateway;
        bool isBurnable;
        bool isActive;
    }

    function addToken(
        uint256 _tokenId,
        address _nativeToken,
        address _mbToken,
        address _treasury,
        address _gateway,
        bool _isBurnable
    ) external;

    function getTokenById(
        uint256 _tokenId
    ) external view returns (Token memory);
}
