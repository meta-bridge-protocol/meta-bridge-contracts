// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMBToken, ILayerZeroEndpointV2} from "./interfaces/IMBToken.sol";
import {MessagingFee, IMetaOApp} from "./interfaces/IMetaOApp.sol";

/**
 * @title LayerZeroBridge Contract
 * @dev LayerZeroBridge is aimed at locking native token on src chain, then mint and send mbToken to the dst chain.
 */
contract LayerZeroBridge is AccessControl {
    using SafeERC20 for ERC20Burnable;

    struct Token {
        uint256 tokenId;
        address nativeToken;
        address mbToken;
        address treasury; // The address of escrow
        address gateway;
        bool isBurnable;
        bool isActive;
    }

    ILayerZeroEndpointV2 public lzEndpoint;
    IMetaOApp public mbOApp;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant TOKEN_ADDER_ROLE = keccak256("TOKEN_ADDER_ROLE");

    // tokenId => Token
    mapping(uint256 => Token) public tokens;
    // nativeToken => tokenId
    mapping(address => uint256) public tokenIds;
    mapping(uint256 => uint256) public bridgeFee;

    event TokenSent(
        address indexed token,
        uint32 indexed dstEid,
        address indexed from,
        uint256 amount,
        uint256 brideFee
    );
    event TokenAdd(address indexed token, uint256 indexed tokenId);
    event TokenRemove(address indexed token);
    event TokenUpdate(address indexed token);

    constructor(address _lzEndpoint, address _oApp) {
        lzEndpoint = ILayerZeroEndpointV2(_lzEndpoint);
        mbOApp = IMetaOApp(_oApp);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // Sends a message from the source to destination chain.
    function send(
        address _nativeToken,
        uint32 _dstEid,
        uint256 _amountLD,
        bytes calldata _extraOptions,
        MessagingFee calldata _fee
    ) external payable {
        uint256 tokenId = tokenIds[_nativeToken];
        require(tokenId != 0, "Invalid token");
        require(
            msg.value == _fee.nativeFee + bridgeFee[_dstEid],
            "Insufficient fee"
        );
        require(tokens[tokenId].isActive, "Token is inactive");

        ERC20Burnable token = ERC20Burnable(_nativeToken);

        if (tokens[tokenId].isBurnable) {
            token.burnFrom(msg.sender, _amountLD);
        } else {
            uint256 balance = token.balanceOf(tokens[tokenId].treasury);
            token.safeTransferFrom(
                msg.sender,
                tokens[tokenId].treasury,
                _amountLD
            );
            uint256 receivedAmount = token.balanceOf(tokens[tokenId].treasury) -
                balance;
            require(
                _amountLD == receivedAmount,
                "Received amount does not match sent amount"
            );
        }

        if (_fee.lzTokenFee > 0) {
            _payLzToken(_fee.lzTokenFee);
        }

        mbOApp.send{value: msg.value - bridgeFee[_dstEid]}(
            _dstEid, // Destination chain's endpoint ID.
            tokenId, // The id of token that will be bridged
            bytes32(uint256(uint160(msg.sender))), // Recipient address.
            _amountLD, // Amount to send in local decimals.
            _extraOptions, // Additional options supplied by the caller to be used in the LayerZero message.
            _fee, // Fee struct containing native gas and ZRO token.
            msg.sender
        );

        emit TokenSent(
            _nativeToken,
            _dstEid,
            msg.sender,
            _amountLD,
            bridgeFee[_dstEid]
        );
    }

    /**
     *
     * @param _tokenId The unique token ID used in the bridge; it must be globally unique across all bridge contracts.
     * @param _nativeToken The address of the native token to bridge to other chains
     * @param _mbToken The address of the mbToken that acts as the intermediary token
     * @param _treasury The treasury address for depositing tokens instead of burning them during the bridging process.
     * We might do that in the main chain or when the token is not burnable
     * @param _gateway The token gateway address
     * @param _isBurnable Sepcifies if the token is burnable or not
     */
    function addToken(
        uint256 _tokenId,
        address _nativeToken,
        address _mbToken,
        address _treasury,
        address _gateway,
        bool _isBurnable
    ) external onlyRole(TOKEN_ADDER_ROLE) {
        require(_nativeToken != address(0), "Invalid token");
        require(_mbToken != address(0), "Invalid mbToken");
        require(_gateway != address(0), "Invalid gateway");
        require(
            tokens[_tokenId].nativeToken == address(0),
            "Token id id already used"
        );
        require(tokenIds[_nativeToken] == 0, "Token already exist");

        if (!_isBurnable) {
            require(
                _treasury != address(0),
                "Treasury address is mandatory for non-burnable tokens"
            );
        }

        tokenIds[_nativeToken] = _tokenId;

        Token storage token = tokens[_tokenId];
        token.tokenId = _tokenId;
        token.nativeToken = _nativeToken;
        token.mbToken = _mbToken;
        token.treasury = _treasury;
        token.gateway = _gateway;
        token.isBurnable = _isBurnable;

        emit TokenAdd(_nativeToken, _tokenId);
    }

    function removeToken(
        address _nativeToken
    ) external onlyRole(TOKEN_ADDER_ROLE) {
        uint256 tokenId = tokenIds[_nativeToken];
        require(tokenId != 0, "Invalid token");

        delete tokens[tokenId];
        delete tokenIds[_nativeToken];
        emit TokenRemove(_nativeToken);
    }

    /**
     *
     * @param _tokenId The unique token ID used in the bridge; it must be globally unique across all bridge contracts.
     * @param _nativeToken The address of the native token to bridge to other chains
     * @param _mbToken The address of the mbToken that acts as the intermediary token
     * @param _treasury The treasury address for depositing tokens instead of burning them during the bridging process.
     * We might do that in the main chain or when the token is not burnable
     * @param _gateway The token gateway address
     * @param _isBurnable Sepcifies if the token is burnable or not
     */
    function updateToken(
        uint256 _tokenId,
        address _nativeToken,
        address _mbToken,
        address _treasury,
        address _gateway,
        bool _isBurnable
    ) external onlyRole(TOKEN_ADDER_ROLE) {
        require(tokens[_tokenId].nativeToken != address(0), "Invalid tokenId");
        require(_nativeToken != address(0), "Invalid token");
        require(_mbToken != address(0), "Invalid mbToken");
        require(_gateway != address(0), "Invalid gateway");

        if (!_isBurnable) {
            require(
                _treasury != address(0),
                "Treasury address is mandatory for non-burnable tokens"
            );
        }

        if (tokens[_tokenId].nativeToken != _nativeToken) {
            require(tokenIds[_nativeToken] == 0, "Token already exists");
            tokenIds[tokens[_tokenId].nativeToken] = 0;
            tokenIds[_nativeToken] = _tokenId;
        }

        Token storage token = tokens[_tokenId];
        token.nativeToken = _nativeToken;
        token.mbToken = _mbToken;
        token.treasury = _treasury;
        token.gateway = _gateway;
        token.isBurnable = _isBurnable;

        emit TokenUpdate(_nativeToken);
    }

    /**
     *
     * @param _dstEid The destination LayerZero endpoint ID for the target chain.
     * @param _fee The fee for bridging, denominated in the native gas token.
     */
    function setBridgeFee(
        uint256 _dstEid,
        uint256 _fee
    ) external onlyRole(ADMIN_ROLE) {
        bridgeFee[_dstEid] = _fee;
    }

    /**
     *
     * @param _lzEndpoint The address of the LayerZero endpoint
     */
    function setLzEndpoint(address _lzEndpoint) external onlyRole(ADMIN_ROLE) {
        lzEndpoint = ILayerZeroEndpointV2(_lzEndpoint);
    }

    /**
     *
     * @param _oApp The address of the LayerZero OApp used as the message-passing tool.
     */
    function setOApp(address _oApp) external onlyRole(ADMIN_ROLE) {
        mbOApp = IMetaOApp(_oApp);
    }

    /**
     *
     * @param _tokenId Id of the bridge token
     * @param _isActive Activation status true|false
     */
    function setTokenStatus(
        uint256 _tokenId,
        bool _isActive
    ) external onlyRole(ADMIN_ROLE) {
        require(tokens[_tokenId].nativeToken != address(0), "Invalid tokenId");

        tokens[_tokenId].isActive = _isActive;
    }

    function adminWithdraw(
        uint256 amount,
        address _to,
        address _tokenAddr
    ) external onlyRole(ADMIN_ROLE) {
        require(_to != address(0), "Invalid receiver");
        if (_tokenAddr == address(0)) {
            payable(_to).transfer(amount);
        } else {
            ERC20Burnable(_tokenAddr).transfer(_to, amount);
        }
    }

    /* @dev Quotes the gas needed to pay for the full omnichain transaction.
     * @return _nativeFee Estimated gas fee in native gas.
     * @return _lzTokenFee Estimated gas fee in ZRO token.
     * @return _bridgeFee Applied bridge fee in native gas.
     */
    function quoteSend(
        address _nativeToken,
        address _from,
        uint32 _dstEid,
        uint256 _amountLD,
        bytes calldata _extraOptions,
        bool _payInLzToken
    )
        external
        view
        returns (uint256 _nativeFee, uint256 _lzTokenFee, uint256 _bridgeFee)
    {
        uint256 tokenId = tokenIds[_nativeToken];
        require(tokenId != 0, "Invalid token");
        MessagingFee memory fee = mbOApp.quoteSend(
            _dstEid,
            tokenId,
            bytes32(uint256(uint160(_from))),
            _amountLD,
            _extraOptions,
            _payInLzToken
        );
        return (fee.nativeFee, fee.lzTokenFee, bridgeFee[_dstEid]);
    }

    /**
     * @dev Get token info, It's used in MetaOApp
     * @param _tokenId The id of token in the bridge
     */
    function getTokenById(
        uint256 _tokenId
    ) external view returns (Token memory) {
        return tokens[_tokenId];
    }

    /**
     * @dev Internal function to pay the LZ token fee associated with the message.
     * @param _lzTokenFee The LZ token fee to be paid.
     *
     * @dev If the caller is trying to pay in the specified lzToken, then the lzTokenFee is passed to the endpoint.
     * @dev Any excess sent, is passed back to the specified _refundAddress in the _lzSend().
     */
    function _payLzToken(uint256 _lzTokenFee) internal virtual {
        address lzToken = lzEndpoint.lzToken();
        require(lzToken != address(0), "lzToken is unavailable");

        // Pay LZ token fee by sending tokens to the endpoint.
        ERC20Burnable(lzToken).safeTransferFrom(
            msg.sender,
            address(this),
            _lzTokenFee
        );
        ERC20Burnable(lzToken).approve(address(lzEndpoint), _lzTokenFee);
    }
}
