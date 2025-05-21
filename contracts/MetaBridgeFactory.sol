// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILayerZeroBridge.sol";
import "./NativeToken.sol";
import "./Gateway.sol";
import "./MBToken.sol";

contract MetaBridgeFactory is Ownable {
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
     * @notice List already deployed tokens on MetaBridge
     * @param _tokenId The unique token ID used in the bridge; it must be globally unique across all bridge contracts.
     * @param _nativeToken The address of the native token to be bridged to other chains
     * @param _bridgeTreasury The treasury address for depositing tokens instead of burning them during
     *  the bridging process. We might do that in the main chain or when the token is not burnable
     * @param _isBurnable Sepcifies if the token is burnable or not
     */
    function ListExistingToken(
        uint256 _tokenId,
        address _nativeToken,
        address _bridgeTreasury,
        bool _isBurnable
    ) external {
        _listToken(_tokenId, _nativeToken, _bridgeTreasury, _isBurnable);
    }

    /**
     * @notice List non-existing tokens on MetaBridge. It will automatically create and deploy the token.
     * Token will be a mintable/burnable ERC20 token.
     * @param _tokenId The unique token ID used in the bridge; it must be globally unique across all bridge contracts.
     * @param _maxSupply The max supply of the token on current chain
     * @param _name The name of the token
     * @param _symbol The symbol of the token
     * @param _bridgeTreasury The treasury address for depositing tokens instead of burning them during
     *  the bridging process. We might do that in the main chain or when the token is not burnable
     */
    function ListNewToken(
        uint256 _tokenId,
        uint256 _maxSupply,
        string memory _name,
        string memory _symbol,
        address _bridgeTreasury
    ) external {
        NativeToken nativeToken = new NativeToken(
            _maxSupply,
            _name,
            _symbol,
            msg.sender
        );

        emit NativeTokenCreated(msg.sender, address(nativeToken));

        _listToken(_tokenId, address(nativeToken), _bridgeTreasury, true);
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
            _isBurnable
        );

        emit MBTokenCreated(msg.sender, address(mbToken));
        emit GatewayCreated(msg.sender, address(gateway));
        emit TokenListed(msg.sender, _nativeToken, _tokenId);
    }
}
