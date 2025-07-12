// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILayerZeroBridge.sol";
import "./NativeToken.sol";
import "./MinterGateway.sol";
import "./MBToken.sol";

contract NewTokensDeployer is Ownable {
    event TokenListed(
        address indexed nativeToken,
        address indexed mbToken,
        uint256 tokenId
    );
    event GatewayCreated(address owner, address gateway);
    event MBTokenCreated(address owner, address mbToken);
    event NativeTokenCreated(address owner, address token);

    address public lzBridge;
    address public mbOApp;

    constructor(address _lzBridge, address _mbOApp) Ownable(msg.sender) {
        lzBridge = _lzBridge;
        mbOApp = _mbOApp;
    }

    /**
     * @notice List non-existing tokens on MetaBridge. It will automatically create and deploy the token.
     * Token will be a mintable/burnable ERC20 token.
     * @param _tokenId The unique token ID used in the bridge; it must be globally unique across all bridge contracts.
     * @param _maxSupply The max supply of the token on current chain
     * @param _name The name of the token
     * @param _symbol The symbol of the token
     * @param _treasury The treasury address for depositing tokens instead of burning them during
     *  the bridging process. We might do that in the main chain or when the token is not burnable
     */
    function ListNewToken(
        uint256 _tokenId,
        uint256 _maxSupply,
        string memory _name,
        string memory _symbol,
        address _treasury,
        bool _isHomeChain
    ) external {
        NativeToken nativeToken = new NativeToken(
            _maxSupply,
            _name,
            _symbol,
            address(this)
        );

        MBToken mbToken = new MBToken(
            string.concat("Meta", _name),
            string.concat("mb", _symbol),
            mbOApp
        );
        MinterGateway gateway = new MinterGateway(
            msg.sender,
            address(nativeToken),
            address(mbToken)
        );

        if (_isHomeChain) {
            nativeToken.mint(_treasury, _maxSupply);
        }

        _setupRoles(address(nativeToken), address(mbToken), address(gateway));

        ILayerZeroBridge(lzBridge).addToken(
            _tokenId,
            address(nativeToken),
            address(mbToken),
            _treasury,
            address(gateway),
            true
        );

        emit NativeTokenCreated(msg.sender, address(nativeToken));
        emit MBTokenCreated(msg.sender, address(mbToken));
        emit GatewayCreated(msg.sender, address(gateway));
        emit TokenListed(address(nativeToken), address(mbToken), _tokenId);
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

    function _setupRoles(
        address _nativeToken,
        address _mbToken,
        address _gateway
    ) internal {
        NativeToken nativeToken = NativeToken(_nativeToken);
        MBToken mbToken = MBToken(_mbToken);

        nativeToken.grantRole(nativeToken.MINTER_ROLE(), _gateway);
        nativeToken.renounceRole(nativeToken.MINTER_ROLE(), address(this));
        nativeToken.transferAdminRoles(msg.sender);

        mbToken.grantRole(mbToken.DEFAULT_ADMIN_ROLE(), msg.sender);
        mbToken.renounceRole(mbToken.DEFAULT_ADMIN_ROLE(), address(this));
    }
}
