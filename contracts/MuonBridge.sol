// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {MessagingFee, IMBToken} from "./interfaces/IMBToken.sol";
import {IGateway} from "./interfaces/IGateway.sol";
import "./interfaces/IMRC20.sol";
import "./interfaces/IMuonClient.sol";

contract MuonBridge is AccessControl {
    using SafeERC20 for ERC20Burnable;
    using ECDSA for bytes32;

    struct Token {
        address rToken;
        address mbToken;
        address treasury; // The address of escrow
        bool isMainChain;
        bool isBurnable;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /**
     * @dev `AddToken` and `setSideContract`
     * are using this role.
     *
     * This role could be granted another contract to let a Muon app
     * manage the tokens. The token deployer will be verified by
     * a Muon app and let the deployer add new tokens to the MTC20Bridges.
     */
    bytes32 public constant TOKEN_ADDER_ROLE = keccak256("TOKEN_ADDER");

    uint256 public muonAppId;
    IMuonClient.PublicKey public muonPublicKey;
    IMuonClient public muon;

    uint256 public network; // current chain id

    // tokenId => Token
    mapping(uint256 => Token) public tokens;
    mapping(address => uint256) public tokenIds;

    event AddToken(address addr, uint256 tokenId);

    event Deposit(uint256 txId);

    event Claim(
        address indexed user,
        uint256 txId,
        uint256 indexed fromChain,
        uint256 amount,
        uint256 indexed tokenId
    );
    /* ========== STATE VARIABLES ========== */
    struct TX {
        // uint256 txId;
        uint256 tokenId;
        uint256 amount;
        uint256 toChain;
        address user;
    }

    uint256 public lastTxId; // unique id for deposit tx
    mapping(uint256 => TX) public txs;

    // source chain => (tx id => false/true)
    mapping(uint256 => mapping(uint256 => bool)) public claimedTxs;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        uint256 _muonAppId,
        IMuonClient.PublicKey memory _muonPublicKey,
        address _muon
    ) {
        network = getExecutingChainID();
        muonAppId = _muonAppId;
        muonPublicKey = _muonPublicKey;
        muon = IMuonClient(_muon);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /* ========== PUBLIC FUNCTIONS ========== */

    function send(
        address _nativeToken,
        uint32 toChain,
        uint256 _amount,
        uint256, // _minAmountLD
        bytes calldata, // _extraOptions
        MessagingFee calldata // _fee
    ) external payable {
        uint256 tokenId = tokenIds[_nativeToken];
        require(uint256(toChain) != network, "Bridge: selfDeposit");
        require(
            tokens[tokenId].rToken != address(0),
            "Bridge: unknown tokenId"
        );

        ERC20Burnable token = ERC20Burnable(tokens[tokenId].rToken);
        if (tokens[tokenId].isMainChain || !tokens[tokenId].isBurnable) {
            uint256 balance = token.balanceOf(tokens[tokenId].treasury);
            token.safeTransferFrom(
                msg.sender,
                tokens[tokenId].treasury,
                _amount
            );
            uint256 receivedAmount = token.balanceOf(tokens[tokenId].treasury) -
                balance;
            require(
                _amount == receivedAmount,
                "Received amount does not match sent amount"
            );
        } else {
            token.burnFrom(msg.sender, _amount);
        }

        uint256 txId = ++lastTxId;
        txs[txId] = TX({
            tokenId: tokenId,
            toChain: uint256(toChain),
            amount: _amount,
            user: msg.sender
        });

        emit Deposit(txId);
    }

    function claim(
        address user,
        uint256 amount,
        uint256 fromChain,
        uint256 toChain,
        uint256 tokenId,
        uint256 txId,
        bytes calldata reqId,
        IMuonClient.SchnorrSign calldata signature
    ) external {
        require(toChain == network, "Bridge: mismatched toChain");

        {
            bytes32 hash = keccak256(
                abi.encodePacked(
                    abi.encodePacked(muonAppId),
                    abi.encodePacked(reqId),
                    abi.encodePacked(txId, tokenId, amount),
                    abi.encodePacked(fromChain, toChain, user)
                )
            );

            require(
                muon.muonVerify(reqId, uint256(hash), signature, muonPublicKey),
                "Bridge: not verified"
            );
        }

        require(!claimedTxs[fromChain][txId], "Bridge: already claimed");
        require(
            tokens[tokenId].rToken != address(0),
            "Bridge: unknown tokenId"
        );

        claimedTxs[fromChain][txId] = true;

        IMBToken mbToken = IMBToken(tokens[tokenId].mbToken); // Mint MUON mbToken
        IGateway gateway = IGateway(mbToken.gateway());
        uint256 gwBalance = IERC20(gateway.nativeToken()).balanceOf(
            address(gateway)
        );

        mbToken.mint(address(this), amount);

        if (gwBalance >= amount) {
            mbToken.approve(address(gateway), amount);
            gateway.swapToNativeTo(amount, user);
        } else {
            if (gwBalance > 0) {
                mbToken.approve(address(gateway), gwBalance);
                gateway.swapToNativeTo(gwBalance, user);
            }
            mbToken.transfer(user, amount - gwBalance);
        }

        emit Claim(user, txId, fromChain, amount, tokenId);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function addToken(
        uint256 tokenId,
        address rToken,
        address mbToken,
        address treasury,
        bool isMainChain,
        bool isBurnable
    ) external onlyRole(TOKEN_ADDER_ROLE) {
        require(tokenIds[rToken] == 0, "already exist");
        require(tokens[tokenId].rToken == address(0), "already exist");

        tokens[tokenId] = Token(
            rToken,
            mbToken,
            treasury,
            isMainChain,
            isBurnable
        );
        tokenIds[rToken] = tokenId;

        emit AddToken(rToken, tokenId);
    }

    function removeToken(
        uint256 tokenId,
        address tokenAddress
    ) external onlyRole(TOKEN_ADDER_ROLE) {
        require(tokenIds[tokenAddress] == tokenId, "id != addr");

        delete tokenIds[tokenAddress];
        delete tokens[tokenId];
    }

    function setNetworkID(uint256 _network) external onlyRole(ADMIN_ROLE) {
        network = _network;
    }

    function setMuonAppId(uint256 _muonAppId) external onlyRole(ADMIN_ROLE) {
        muonAppId = _muonAppId;
    }

    function setMuonContract(address addr) external onlyRole(ADMIN_ROLE) {
        muon = IMuonClient(addr);
    }

    function setMuonPubKey(
        IMuonClient.PublicKey memory _muonPublicKey
    ) external onlyRole(ADMIN_ROLE) {
        muonPublicKey = _muonPublicKey;
    }

    function emergencyWithdrawETH(
        uint256 amount,
        address addr
    ) external onlyRole(ADMIN_ROLE) {
        require(addr != address(0));
        payable(addr).transfer(amount);
    }

    function emergencyWithdrawERC20Tokens(
        address _tokenAddr,
        address _to,
        uint256 _amount
    ) external onlyRole(ADMIN_ROLE) {
        ERC20Burnable(_tokenAddr).transfer(_to, _amount);
    }

    /* ========== VIEWS ========== */

    function pendingTxs(
        uint256 fromChain,
        uint256[] calldata _ids
    ) external view returns (bool[] memory unclaimedIds) {
        unclaimedIds = new bool[](_ids.length);
        for (uint256 i = 0; i < _ids.length; i++) {
            unclaimedIds[i] = claimedTxs[fromChain][_ids[i]];
        }
    }

    function getTx(
        uint256 _txId
    )
        external
        view
        returns (
            uint256 txId,
            uint256 tokenId,
            uint256 amount,
            uint256 fromChain,
            uint256 toChain,
            address user
        )
    {
        txId = _txId;
        tokenId = txs[_txId].tokenId;
        amount = txs[_txId].amount;
        fromChain = network;
        toChain = txs[_txId].toChain;
        user = txs[_txId].user;
    }

    function getExecutingChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function quoteSend(
        address, // _nativeToken
        address, // _from
        uint32, // _dstEid
        uint256, // _amount
        uint256, // _minAmountLD
        bytes calldata, // _extraOptions
        bool // _payInLzToken
    ) external pure returns (uint256 nativeFee, uint256 lzTokenFee) {
        return (0, 0);
    }
}
