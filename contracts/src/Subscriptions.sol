// SPDX-License-Identifier: Apache-2.0
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title Subscriptions
/// @notice Recurring pulls from a subscriber's standing token allowance. A plan
/// owner registers a plan (token, amount, period, destination, puller). A
/// subscriber subscribes to it, directly or through a relayer with an EIP-712
/// `Subscribe` signature (optionally preceded by an EIP-2612 `permit`). The
/// plan's puller may then take at most the plan amount once per period: the
/// first period is due at subscribe time, and each charge moves the next due
/// time forward by exactly one period.
/// @dev No admin, no pause switch and non-upgradeable; it never holds tokens or
/// ETH. A plan's token, amount and period never change after `createPlan`, so a
/// `Subscribe` signature over a plan key commits to those terms. The owner can
/// redirect a plan's destination and puller, which never raises what the
/// subscriber can be charged. Periods missed by the puller stay collectable,
/// one charge per elapsed period. Pausing and resuming skip the paused time.
/// The subscriber stops all pulls by cancelling or by revoking the allowance.
/// Contract-wallet (EIP-1271) subscribers use `subscribe` directly.
contract Subscriptions is EIP712, Nonces {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Active,
        Paused,
        Canceled
    }

    struct Plan {
        address owner;
        address puller;
        address destination;
        IERC20 token;
        uint256 amount;
        uint64 periodSeconds;
        bool active;
    }

    struct Sub {
        bytes32 planKey;
        address subscriber;
        uint64 nextChargeAt;
        Status status;
    }

    uint64 public constant MAX_PERIOD_SECONDS = 10 * 365 days;
    bytes32 public constant SUBSCRIBE_TYPEHASH =
        keccak256("Subscribe(bytes32 planKey,address subscriber,uint256 nonce,uint256 deadline)");

    /// @notice Plans by `keccak256(abi.encode(owner, planId))`.
    mapping(bytes32 planKey => Plan) public plans;
    /// @notice Subscriptions by `keccak256(abi.encode(planKey, subscriber))`.
    mapping(bytes32 subId => Sub) public subscriptions;

    event PlanCreated(
        bytes32 indexed planKey,
        address indexed owner,
        bytes32 indexed planId,
        address token,
        uint256 amount,
        uint64 periodSeconds,
        address destination,
        address puller
    );
    event PlanDestinationSet(bytes32 indexed planKey, address indexed destination);
    event PlanPullerSet(bytes32 indexed planKey, address indexed puller);
    event PlanDeactivated(bytes32 indexed planKey);
    event Subscribed(bytes32 indexed subId, bytes32 indexed planKey, address indexed subscriber, uint64 nextChargeAt);
    event Charged(
        bytes32 indexed subId,
        bytes32 indexed planKey,
        address indexed subscriber,
        address destination,
        uint256 amount,
        uint64 nextChargeAt
    );
    event Canceled(bytes32 indexed subId, address indexed by);
    event Paused(bytes32 indexed subId, address indexed by);
    event Resumed(bytes32 indexed subId, address indexed by, uint64 nextChargeAt);

    error NotDueYet();
    error NotActive();
    error Unauthorized();
    error AmountExceedsPlan();
    error InvalidPeriod();
    error InvalidAmount();
    error PlanInactive();
    error AlreadySubscribed();
    error ExpiredSignature();
    error InvalidSignature();
    error PlanExists();
    error NotPaused();
    error ZeroAddress();

    constructor() EIP712("Subscriptions", "1") {}

    // ---------------------------------------------------------------- plans

    /// @notice Registers a plan owned by the caller.
    /// @param planId Caller-chosen id; the plan key is
    /// `keccak256(abi.encode(msg.sender, planId))`.
    /// @param amount Most the puller may take per period, in token units.
    /// @param periodSeconds Billing period, from 1 second to 10 years.
    function createPlan(
        bytes32 planId,
        IERC20 token,
        uint256 amount,
        uint64 periodSeconds,
        address destination,
        address puller
    ) external returns (bytes32 planKey) {
        if (periodSeconds == 0 || periodSeconds > MAX_PERIOD_SECONDS) revert InvalidPeriod();
        if (amount == 0) revert InvalidAmount();
        if (address(token) == address(0) || destination == address(0) || puller == address(0)) {
            revert ZeroAddress();
        }
        planKey = keccak256(abi.encode(msg.sender, planId));
        // Terms are immutable: a plan key can never be redefined.
        if (plans[planKey].owner != address(0)) revert PlanExists();

        plans[planKey] = Plan({
            owner: msg.sender,
            puller: puller,
            destination: destination,
            token: token,
            amount: amount,
            periodSeconds: periodSeconds,
            active: true
        });
        emit PlanCreated(planKey, msg.sender, planId, address(token), amount, periodSeconds, destination, puller);
    }

    /// @notice Sends this plan's future charges to `destination`. Owner only.
    function setPlanDestination(bytes32 planKey, address destination) external {
        Plan storage plan = _ownedPlan(planKey);
        if (destination == address(0)) revert ZeroAddress();
        plan.destination = destination;
        emit PlanDestinationSet(planKey, destination);
    }

    /// @notice Hands the right to charge this plan's subscriptions to `puller`.
    /// Owner only.
    function setPlanPuller(bytes32 planKey, address puller) external {
        Plan storage plan = _ownedPlan(planKey);
        if (puller == address(0)) revert ZeroAddress();
        plan.puller = puller;
        emit PlanPullerSet(planKey, puller);
    }

    /// @notice Stops new subscriptions to this plan for good. Existing
    /// subscriptions keep billing until they are cancelled. Owner only.
    function deactivatePlan(bytes32 planKey) external {
        Plan storage plan = _ownedPlan(planKey);
        if (!plan.active) revert PlanInactive();
        plan.active = false;
        emit PlanDeactivated(planKey);
    }

    // ------------------------------------------------------------ subscribe

    /// @notice Subscribes the caller, who pays the gas. The first period is due
    /// at once. The caller must have approved this contract on the plan's token.
    function subscribe(bytes32 planKey) external returns (bytes32 subId) {
        return _subscribe(planKey, msg.sender);
    }

    /// @notice Subscribes `subscriber` on their EIP-712 signature over
    /// `Subscribe(bytes32 planKey,address subscriber,uint256 nonce,uint256 deadline)`
    /// with `nonce = nonces(subscriber)`. Anyone may relay it.
    /// @param deadline Last block timestamp (inclusive) at which `sig` is valid.
    /// @param sig 65-byte `r, s, v` signature of an externally owned account.
    function subscribeWithAuthorization(bytes32 planKey, address subscriber, uint256 deadline, bytes calldata sig)
        external
        returns (bytes32 subId)
    {
        _useSubscribeAuthorization(planKey, subscriber, deadline, sig);
        return _subscribe(planKey, subscriber);
    }

    /// @notice Applies the subscriber's EIP-2612 permit for this contract on the
    /// plan's token, then subscribes as `subscribeWithAuthorization` does.
    /// @dev A permit that fails is ignored when the allowance it grants is
    /// already in place, so copying the permit out of the mempool and
    /// submitting it first cannot block the subscribe. Otherwise the token's
    /// revert reason is re-thrown.
    function subscribeWithPermit(
        bytes32 planKey,
        address subscriber,
        uint256 permitValue,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint256 deadline,
        bytes calldata sig
    ) external returns (bytes32 subId) {
        Plan storage plan = plans[planKey];
        if (!plan.active) revert PlanInactive();
        _permit(plan.token, subscriber, permitValue, permitDeadline, v, r, s);
        _useSubscribeAuthorization(planKey, subscriber, deadline, sig);
        return _subscribe(planKey, subscriber);
    }

    // --------------------------------------------------------------- charge

    /// @notice Pulls `amount` from the subscriber to the plan's destination and
    /// moves the next due time forward by one period. Puller only.
    /// @param amount At most the plan amount; less is allowed (for example a
    /// discounted period) and still uses up the period.
    function charge(bytes32 subId, uint256 amount) external {
        Sub storage sub = subscriptions[subId];
        bytes32 planKey = sub.planKey;
        Plan storage plan = plans[planKey];
        // An unknown subscription has no plan, whose puller is address(0).
        if (msg.sender != plan.puller) revert Unauthorized();
        if (sub.status != Status.Active) revert NotActive();
        if (amount == 0) revert InvalidAmount();
        if (amount > plan.amount) revert AmountExceedsPlan();
        uint64 dueAt = sub.nextChargeAt;
        if (block.timestamp < dueAt) revert NotDueYet();

        uint64 nextChargeAt = dueAt + plan.periodSeconds;
        sub.nextChargeAt = nextChargeAt;
        address subscriber = sub.subscriber;
        address destination = plan.destination;
        plan.token.safeTransferFrom(subscriber, destination, amount);
        emit Charged(subId, planKey, subscriber, destination, amount, nextChargeAt);
    }

    // --------------------------------------------------------------- status

    /// @notice Ends the subscription; nothing more can be charged. Subscriber
    /// or plan owner. The subscriber may subscribe to the plan again later.
    function cancel(bytes32 subId) external {
        Sub storage sub = _authorizedSub(subId);
        Status status = sub.status;
        if (status != Status.Active && status != Status.Paused) revert NotActive();
        sub.status = Status.Canceled;
        emit Canceled(subId, msg.sender);
    }

    /// @notice Suspends charging. Subscriber or plan owner.
    function pause(bytes32 subId) external {
        Sub storage sub = _authorizedSub(subId);
        if (sub.status != Status.Active) revert NotActive();
        sub.status = Status.Paused;
        emit Paused(subId, msg.sender);
    }

    /// @notice Restarts charging with the next charge one full period from now,
    /// so the paused time is never charged. Subscriber or plan owner.
    function resume(bytes32 subId) external {
        Sub storage sub = _authorizedSub(subId);
        if (sub.status != Status.Paused) revert NotPaused();
        // A uint64 of seconds lasts far beyond any block timestamp.
        uint64 nextChargeAt = uint64(block.timestamp) + plans[sub.planKey].periodSeconds;
        sub.nextChargeAt = nextChargeAt;
        sub.status = Status.Active;
        emit Resumed(subId, msg.sender, nextChargeAt);
    }

    // ------------------------------------------------------------- internal

    function _subscribe(bytes32 planKey, address subscriber) private returns (bytes32 subId) {
        if (!plans[planKey].active) revert PlanInactive();
        subId = keccak256(abi.encode(planKey, subscriber));
        Status status = subscriptions[subId].status;
        if (status == Status.Active || status == Status.Paused) revert AlreadySubscribed();

        uint64 nextChargeAt = uint64(block.timestamp);
        subscriptions[subId] =
            Sub({planKey: planKey, subscriber: subscriber, nextChargeAt: nextChargeAt, status: Status.Active});
        emit Subscribed(subId, planKey, subscriber, nextChargeAt);
    }

    /// @dev Checks the deadline and the signature and uses up the subscriber's
    /// nonce, so a signature subscribes at most once.
    function _useSubscribeAuthorization(bytes32 planKey, address subscriber, uint256 deadline, bytes calldata sig)
        private
    {
        if (block.timestamp > deadline) revert ExpiredSignature();
        uint256 nonce = _useNonce(subscriber);
        // forge-lint: disable-next-line(asm-keccak256)
        bytes32 structHash = keccak256(abi.encode(SUBSCRIBE_TYPEHASH, planKey, subscriber, nonce, deadline));
        (address signer, ECDSA.RecoverError error,) = ECDSA.tryRecover(_hashTypedDataV4(structHash), sig);
        if (error != ECDSA.RecoverError.NoError || signer != subscriber) revert InvalidSignature();
    }

    function _permit(IERC20 token, address subscriber, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        private
    {
        try IERC20Permit(address(token)).permit(subscriber, address(this), value, deadline, v, r, s) {}
        catch (bytes memory reason) {
            if (token.allowance(subscriber, address(this)) < value) {
                assembly ("memory-safe") {
                    revert(add(reason, 0x20), mload(reason))
                }
            }
        }
    }

    function _ownedPlan(bytes32 planKey) private view returns (Plan storage plan) {
        plan = plans[planKey];
        // An unknown plan's owner is address(0), which never calls.
        if (msg.sender != plan.owner) revert Unauthorized();
    }

    function _authorizedSub(bytes32 subId) private view returns (Sub storage sub) {
        sub = subscriptions[subId];
        if (msg.sender != sub.subscriber && msg.sender != plans[sub.planKey].owner) revert Unauthorized();
    }
}
