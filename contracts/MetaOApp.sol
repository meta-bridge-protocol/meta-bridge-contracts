// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OApp, Origin, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGateway} from "./interfaces/IGateway.sol";
import {MBToken} from "./MBToken.sol";
import {ILayerZeroBridge} from "./interfaces/ILayerZeroBridge.sol";
import {OAppMsgCodec} from "./utils/OAppMsgCodec.sol";

contract MetaOApp is OApp {
    using OAppMsgCodec for bytes32;

    ILayerZeroBridge public lzBridge;

    // @notice Provides a conversion rate when swapping between denominations of SD and LD
    //      - shareDecimals == SD == shared Decimals
    //      - localDecimals == LD == local decimals
    // @dev Considers that tokens have different decimal amounts on various chains.
    // @dev eg.
    //  For a token
    //      - locally with 4 decimals --> 1.2345 => uint(12345)
    //      - remotely with 2 decimals --> 1.23 => uint(123)
    //      - The conversion rate would be 10 ** (4 - 2) = 100
    //  @dev If you want to send 1.2345 -> (uint 12345), you CANNOT represent that value on the remote,
    //  you can only display 1.23 -> uint(123).
    //  @dev To preserve the dust that would otherwise be lost on that conversion,
    //  we need to unify a denomination that can be represented on ALL chains inside of the OFT mesh
    uint256 public immutable decimalConversionRate;

    event TokenSent(
        uint32 indexed dstEid,
        address indexed from,
        bytes32 indexed receiver,
        uint256 amount,
        bytes payload
    );
    event TokenReceived(
        uint32 indexed srcEid,
        bytes32 indexed sender,
        bytes32 guid,
        address receiver,
        uint256 amount,
        address executor,
        bytes extraData
    );

    /**
     * @dev Modifier to allow only bridge do something
     */
    modifier onlyBridge() {
        require(msg.sender == address(lzBridge), "Caller is not lzBridge");
        _;
    }

    constructor(
        uint8 _localDecimals,
        address _endpoint,
        address _owner
    ) OApp(_endpoint, _owner) Ownable(_owner) {
        require(_localDecimals >= sharedDecimals(), "Invalid local decimals");
        decimalConversionRate = 10 ** (_localDecimals - sharedDecimals());
    }

    function setLzBridge(address _lzBridge) external onlyOwner {
        lzBridge = ILayerZeroBridge(_lzBridge);
    }

    /**
     * @notice Sends a message from the source to destination chain.
     * @param _dstEid Destination chain's endpoint ID.
     * @param _tokenId The id of the bridge token that is involved in the transaction
     * @param _receiver The receiver of token.
     * @param _amountLD Amount to bridge in local decimals
     * @param _options Message execution options (e.g., for sending gas to destination).
     * @param _fee The calculated fee for the send() operation.
     *      - nativeFee: The native fee.
     *      - lzTokenFee: The lzToken fee.
     * @param _refundAddress The address to receive any excess funds.
     */
    function send(
        uint32 _dstEid,
        uint256 _tokenId,
        bytes32 _receiver,
        uint256 _amountLD,
        bytes calldata _options,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable onlyBridge {
        // @dev Remove the dust so nothing is lost on the conversion between chains with different decimals for the token.
        uint256 amountSentLD = _removeDust(_amountLD);

        // Encodes the message before invoking _lzSend.
        // Replace with whatever data you want to send!
        bytes memory payload = abi.encode(
            _tokenId,
            _receiver,
            _toSD(amountSentLD)
        );
        _lzSend(
            _dstEid,
            payload,
            _options,
            _fee,
            // Refund address in case of failed source message.
            _refundAddress
        );
        emit TokenSent(_dstEid, msg.sender, _receiver, _amountLD, payload);
    }

    /**
     * @notice Provides a quote for the send() operation.
     * @param _dstEid The destination endpoint ID.
     * @param _tokenId The id of the bridge token that is involved in the transaction
     * @param _receiver The address of receiver on destination
     * @param _amountLD Amount to bridge in local decimals
     * @param _options Additional options for the message.
     * @param _payInLzToken Flag indicating whether the caller is paying in the LZ token.
     * @return msgFee The calculated LayerZero messaging fee from the send() operation.
     *
     * @dev MessagingFee: LayerZero msg fee
     *  - nativeFee: The native fee.
     *  - lzTokenFee: The lzToken fee.
     */
    function quoteSend(
        uint32 _dstEid,
        uint256 _tokenId,
        bytes32 _receiver,
        uint256 _amountLD,
        bytes memory _options,
        bool _payInLzToken
    ) external view virtual returns (MessagingFee memory msgFee) {
        // @dev Remove the dust so nothing is lost on the conversion between chains with different decimals for the token.
        uint256 amountSentLD = _removeDust(_amountLD);

        bytes memory message = abi.encode(
            _tokenId,
            _receiver,
            _toSD(amountSentLD)
        );

        // @dev Calculates the LayerZero fee for the send() operation.
        return _quote(_dstEid, message, _options, _payInLzToken);
    }

    /**
     * @dev Retrieves the shared decimals of the OFT.
     * @return The shared decimals of the OFT.
     *
     * @dev Sets an implicit cap on the amount of tokens, over uint64.max() will need some sort of outbound cap / totalSupply cap
     * Lowest common decimal denominator between chains.
     * Defaults to 6 decimal places to provide up to 18,446,744,073,709.551615 units (max uint64).
     * For tokens exceeding this totalSupply(), they will need to override the sharedDecimals function with something smaller.
     * ie. 4 sharedDecimals would be 1,844,674,407,370,955.1615
     */
    function sharedDecimals() public view virtual returns (uint8) {
        return 6;
    }

    /**
     * @dev Called when data is received from the protocol. It overrides the equivalent function in the parent contract.
     * Protocol messages are defined as packets, comprised of the following parameters.
     * @param _origin A struct containing information about where the packet came from.
     * @param _guid A global unique identifier for tracking the packet.
     * @param _payload Encoded message.
     * @param _executor Executor address.
     * @param _extraData Any extra data or options to trigger on receipt.
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _payload,
        address _executor,
        bytes calldata _extraData
    ) internal override {
        (uint256 tokenId, bytes32 receiver, uint64 amount) = abi.decode(
            _payload,
            (uint256, bytes32, uint64)
        );

        ILayerZeroBridge.Token memory bridgeToken = lzBridge.getTokenById(
            tokenId
        );

        MBToken mbToken = MBToken(bridgeToken.mbToken);
        IGateway gateway = IGateway(bridgeToken.gateway);

        mbToken.mint(address(this), _toLD(amount));
        mbToken.approve(address(gateway), amount);
        gateway.swapToNativeTo(amount, receiver.bytes32ToAddress());

        emit TokenReceived(
            _origin.srcEid,
            _origin.sender,
            _guid,
            receiver.bytes32ToAddress(),
            amount,
            _executor,
            _extraData
        );
    }

    /**
     * @dev Internal function to remove dust from the given local decimal amount.
     * @param _amountLD The amount in local decimals.
     * @return amountLD The amount after removing dust.
     *
     * @dev Prevents the loss of dust when moving amounts between chains with different decimals.
     * @dev eg. uint(123) with a conversion rate of 100 becomes uint(100).
     */
    function _removeDust(
        uint256 _amountLD
    ) internal view virtual returns (uint256 amountLD) {
        return (_amountLD / decimalConversionRate) * decimalConversionRate;
    }

    /**
     * @dev Internal function to convert an amount from shared decimals into local decimals.
     * @param _amountSD The amount in shared decimals.
     * @return amountLD The amount in local decimals.
     */
    function _toLD(
        uint64 _amountSD
    ) internal view virtual returns (uint256 amountLD) {
        return _amountSD * decimalConversionRate;
    }

    /**
     * @dev Internal function to convert an amount from local decimals into shared decimals.
     * @param _amountLD The amount in local decimals.
     * @return amountSD The amount in shared decimals.
     */
    function _toSD(
        uint256 _amountLD
    ) internal view virtual returns (uint64 amountSD) {
        return uint64(_amountLD / decimalConversionRate);
    }
}
