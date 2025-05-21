// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILayerZeroBridge.sol";
import "./NativeToken.sol";
import "./Gateway.sol";
import "./MBToken.sol";

contract MetaBridgeFactory is Ownable {
    event GatewayCreated(address owner, address gateway);
    event MBTokenCreated(address owner, address mbToken);

    address public lzBridge;
    address public mbOApp;

    constructor(address _lzBridge, address _mbOApp) Ownable(msg.sender) {
        lzBridge = _lzBridge;
        mbOApp = _mbOApp;
    }

    function ListExistingToken(
        uint256 _tokenId,
        address _nativeToken,
        address _bridgeTreasury,
        bool _isMainChain,
        bool _isBurnable
    ) external {
        _listToken(
            _tokenId,
            _nativeToken,
            _bridgeTreasury,
            _isMainChain,
            _isBurnable
        );
    }

    function ListNewToken(
        uint256 _tokenId,
        uint256 _maxSupply,
        string memory _name,
        string memory _symbol,
        address _bridgeTreasury,
        bool _isMainChain
    ) external {
        NativeToken nativeToken = new NativeToken(_maxSupply, _name, _symbol);

        _listToken(
            _tokenId,
            address(nativeToken),
            _bridgeTreasury,
            _isMainChain,
            true
        );
    }

    /**
     *
     * @param _lzBridge The address of the bridge contract
     */
    function setLzBridge(address _lzBridge) external onlyOwner {
        lzBridge = _lzBridge;
    }

    /**
     *
     * @param _oApp The address of the LayerZero OApp used as the message-passing tool in the bridge.
     */
    function setOApp(address _oApp) external onlyOwner {
        mbOApp = _oApp;
    }

    function _listToken(
        uint256 _tokenId,
        address _nativeToken,
        address _bridgeTreasury,
        bool _isMainChain,
        bool _isBurnable
    ) internal {
        string memory tokenName = ERC20(_nativeToken).name();
        string memory tokenSymbol = ERC20(_nativeToken).symbol();

        MBToken mbToken = new MBToken(
            string.concat("Meta", tokenName),
            string.concat("mb", tokenSymbol)
        );
        Gateway gateway = new Gateway(
            msg.sender,
            _nativeToken,
            address(mbToken)
        );

        mbToken.grantRole(mbToken.MINTER_ROLE(), mbOApp);
        mbToken.grantRole(mbToken.DEFAULT_ADMIN_ROLE(), msg.sender);
        mbToken.renounceRole(mbToken.DEFAULT_ADMIN_ROLE(), address(this));

        ILayerZeroBridge(lzBridge).addToken(
            _tokenId,
            _nativeToken,
            address(mbToken),
            _bridgeTreasury,
            address(gateway),
            _isMainChain,
            _isBurnable
        );

        emit MBTokenCreated(msg.sender, address(mbToken));
        emit GatewayCreated(msg.sender, address(gateway));
    }
}
