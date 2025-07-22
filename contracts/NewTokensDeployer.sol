// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./utils/DeployFactory.sol";
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
        uint256 salt = uint256(keccak256(abi.encode(msg.sender)));

        address nativeToken = DeployFactory.deployContract(
            _getNativeTokenBytecode(_maxSupply, _name, _symbol),
            salt
        );

        address mbToken = DeployFactory.deployContract(
            _getMBTokenBytecode(
                string.concat("Meta", _name),
                string.concat("mb", _symbol)
            ),
            salt
        );

        address gateway = DeployFactory.deployContract(
            _getGatewayBytecode(msg.sender, nativeToken, mbToken),
            salt
        );

        if (_isHomeChain) {
            NativeToken(nativeToken).mint(_treasury, _maxSupply);
        }

        _setupRoles(nativeToken, mbToken, gateway);

        ILayerZeroBridge(lzBridge).addToken(
            _tokenId,
            nativeToken,
            mbToken,
            _treasury,
            gateway,
            true
        );

        emit NativeTokenCreated(msg.sender, nativeToken);
        emit MBTokenCreated(msg.sender, mbToken);
        emit GatewayCreated(msg.sender, gateway);
        emit TokenListed(nativeToken, mbToken, _tokenId);
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

    function _getNativeTokenBytecode(
        uint256 _maxSupply,
        string memory _name,
        string memory _symbol
    ) internal view returns (bytes memory) {
        bytes memory bytecode = type(NativeToken).creationCode;
        return
            abi.encodePacked(
                bytecode,
                abi.encode(_maxSupply, _name, _symbol, address(this))
            );
    }

    function _getMBTokenBytecode(
        string memory _name,
        string memory _symbol
    ) internal view returns (bytes memory) {
        bytes memory bytecode = type(MBToken).creationCode;
        return abi.encodePacked(bytecode, abi.encode(_name, _symbol, mbOApp));
    }

    function _getGatewayBytecode(
        address _admin,
        address _nativeToken,
        address _mbToken
    ) internal pure returns (bytes memory) {
        bytes memory bytecode = type(MinterGateway).creationCode;
        return
            abi.encodePacked(
                bytecode,
                abi.encode(_admin, _nativeToken, _mbToken)
            );
    }
}
