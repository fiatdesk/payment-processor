// SPDX-License-Identifier: Apache-2.0
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title MockUSDC
/// @notice TEST ONLY. A stand-in for Circle's FiatTokenV2 on Anvil: 6 decimals,
/// EIP-2612 `permit`, EIP-3009 transfer/receive with authorization and the
/// blacklist checks, with FiatTokenV2's EIP-712 domain (name "USD Coin",
/// version "2") and revert strings. Minting and blacklisting are open to
/// anyone. Never deploy it outside a local test chain.
/// @dev The permit logic mirrors OpenZeppelin's ERC20Permit, whose constructor
/// fixes the EIP-712 version to "1"; FiatTokenV2 signs with version "2".
/// Known gaps against FiatTokenV2_2:
/// - An allowance of `type(uint256).max` is never decremented (OpenZeppelin's
///   `_spendAllowance`); FiatToken decrements every allowance.
/// - Balance and allowance failures revert with OpenZeppelin custom errors
///   (`ERC20InsufficientBalance`, `ERC20InsufficientAllowance`, ...) instead of
///   FiatToken's "ERC20: transfer amount exceeds ..." strings.
/// - No `cancelAuthorization`, no `bytes signature` overloads and no EIP-1271
///   (smart-contract wallet) signatures: only 65-byte EOA `v, r, s`.
/// - No pause, no minter roles or allowances, no owner and no rescuer.
contract MockUSDC is ERC20, IERC20Permit, EIP712, Nonces {
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    mapping(address account => bool) private _blacklisted;
    mapping(address authorizer => mapping(bytes32 nonce => bool)) private _authorizationStates;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    modifier notBlacklisted(address account) {
        require(!_blacklisted[account], "Blacklistable: account is blacklisted");
        _;
    }

    constructor() ERC20("USD Coin", "USDC") EIP712("USD Coin", "2") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function version() external pure returns (string memory) {
        return "2";
    }

    /// @notice Test hook: mints without any minter role.
    function mint(address to, uint256 value) external notBlacklisted(to) {
        _mint(to, value);
    }

    /// @notice Test hook: freezes or unfreezes `account`.
    function blacklist(address account, bool blacklisted) external {
        _blacklisted[account] = blacklisted;
    }

    function isBlacklisted(address account) external view returns (bool) {
        return _blacklisted[account];
    }

    function transfer(address to, uint256 value)
        public
        override
        notBlacklisted(msg.sender)
        notBlacklisted(to)
        returns (bool)
    {
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value)
        public
        override
        notBlacklisted(msg.sender)
        notBlacklisted(from)
        notBlacklisted(to)
        returns (bool)
    {
        return super.transferFrom(from, to, value);
    }

    function approve(address spender, uint256 value)
        public
        override
        notBlacklisted(msg.sender)
        notBlacklisted(spender)
        returns (bool)
    {
        return super.approve(spender, value);
    }

    /// @inheritdoc IERC20Permit
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        notBlacklisted(owner)
        notBlacklisted(spender)
    {
        require(deadline >= block.timestamp, "FiatTokenV2: permit is expired");
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline));
        require(_isSignedBy(owner, structHash, v, r, s), "EIP2612: invalid signature");
        _approve(owner, spender, value);
    }

    /// @inheritdoc IERC20Permit
    function nonces(address owner) public view override(IERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    /// @inheritdoc IERC20Permit
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice EIP-3009: anyone may submit `from`'s signed authorization.
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external notBlacklisted(from) notBlacklisted(to) {
        bytes32 structHash = keccak256(
            abi.encode(TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce)
        );
        _useAuthorization(from, nonce, validAfter, validBefore, structHash, v, r, s);
        _transfer(from, to, value);
    }

    /// @notice EIP-3009: only the payee may submit, which blocks front-running.
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external notBlacklisted(from) notBlacklisted(to) {
        require(to == msg.sender, "FiatTokenV2: caller must be the payee");
        bytes32 structHash =
            keccak256(abi.encode(RECEIVE_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce));
        _useAuthorization(from, nonce, validAfter, validBefore, structHash, v, r, s);
        _transfer(from, to, value);
    }

    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    function _useAuthorization(
        address authorizer,
        bytes32 nonce,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 structHash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) private {
        require(block.timestamp > validAfter, "FiatTokenV2: authorization is not yet valid");
        require(block.timestamp < validBefore, "FiatTokenV2: authorization is expired");
        require(!_authorizationStates[authorizer][nonce], "FiatTokenV2: authorization is used or canceled");
        require(_isSignedBy(authorizer, structHash, v, r, s), "FiatTokenV2: invalid signature");
        _authorizationStates[authorizer][nonce] = true;
        emit AuthorizationUsed(authorizer, nonce);
    }

    function _isSignedBy(address signer, bytes32 structHash, uint8 v, bytes32 r, bytes32 s)
        private
        view
        returns (bool)
    {
        (address recovered, ECDSA.RecoverError error,) = ECDSA.tryRecover(_hashTypedDataV4(structHash), v, r, s);
        return error == ECDSA.RecoverError.NoError && recovered == signer;
    }
}
