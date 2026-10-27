// SPDX-License-Identifier: Apache-2.0
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title Subscriptions
/// @notice Recurring pulls from a subscriber's token allowance. A plan owner
/// registers a plan (token, amount, period, destination, puller). A subscriber
/// subscribes to it directly, or through a relayer with an EIP-712 `Subscribe`
/// signature over the plan key and the plan's token, amount and period
/// (optionally preceded by an EIP-2612 `permit`). The plan's puller may then
/// take at most the plan amount once per billing period. Billing periods follow
/// a fixed grid that starts at the first charge time: the subscribe time, or a
/// later `firstChargeAt` the subscriber chose (signed, at most 365 days ahead,
/// for example the end of a trial). A charge moves the next due time to the
/// first grid point after it, so a period the puller missed is skipped, never
/// collected later. Pausing never moves the grid.
/// @dev No admin, no pause switch and non-upgradeable; it never holds tokens or
/// ETH. Standard ERC-20 tokens only: with a fee-on-transfer token the
/// destination would receive less than `Charged` reports.
///
/// A plan's token, amount and period never change after `createPlan`, and a
/// `Subscribe` signature names all three, so the wallet shows the subscriber
/// what they agree to. The owner can redirect a plan's destination and puller,
/// which never raises what the subscriber can be charged.
///
/// The contract expects a bounded allowance, for example
/// `amount * max(12, ceil(365 days / periodSeconds))`. The per-period cap is
/// enforced here and the allowance caps the total, so a signature obtained by
/// phishing can spend at most the subscriber's remaining allowance to this
/// contract.
///
/// Subscribing directly and cancelling both use up the subscriber's nonce, so
/// once a subscriber has cancelled, no `Subscribe` signature handed out earlier
/// can subscribe them again. Revoking the allowance also stops every pull.
/// Signatures from contract wallets are checked with EIP-1271.
contract Subscriptions is EIP712, Nonces {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Active,
        Paused,
        Canceled
    }

    /// @notice Who paused a subscription, which decides who may resume it.
    enum PausedBy {
        None,
        Subscriber,
        Owner
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

    /// @notice A plan's terms as a relayed subscribe states them; they must
    /// equal the plan's and are part of the signed `Subscribe` message.
    struct Terms {
        IERC20 token;
        uint256 amount;
        uint64 periodSeconds;
    }

    struct Sub {
        bytes32 planKey;
        address subscriber;
        uint64 nextChargeAt;
        Status status;
        PausedBy pausedBy;
    }

    uint64 public constant MAX_PERIOD_SECONDS = 10 * 365 days;
    /// @notice How far ahead a subscription's first charge may be set.
    uint64 public constant MAX_FIRST_CHARGE_DELAY = 365 days;
    bytes32 public constant SUBSCRIBE_TYPEHASH = keccak256(
        "Subscribe(bytes32 planKey,address subscriber,address token,uint256 amount,uint64 periodSeconds,uint64 firstChargeAt,uint256 nonce,uint256 deadline)"
    );

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
    error TermsMismatch();
    error InvalidFirstCharge();

    constructor() EIP712("Subscriptions", "1") {}

    // ---------------------------------------------------------------- plans

    /// @notice Registers a plan owned by the caller.
    /// @param planId Caller-chosen id; the plan key is
    /// `keccak256(abi.encode(msg.sender, planId))`.
    /// @param token A standard ERC-20 token (no fee on transfer).
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
    /// Uses up the caller's nonce, retiring any `Subscribe` signature they have
    /// handed out.
    function subscribe(bytes32 planKey) external returns (bytes32 subId) {
        subId = _subscribe(planKey, msg.sender, 0);
        _useNonce(msg.sender);
    }

    /// @notice Subscribes the caller as `subscribe(planKey)` does, with the
    /// first period due at `firstChargeAt` (for example after a trial).
    /// @param firstChargeAt 0 for now, else a time from now to
    /// `MAX_FIRST_CHARGE_DELAY` ahead; anything else reverts with
    /// `InvalidFirstCharge`.
    function subscribe(bytes32 planKey, uint64 firstChargeAt) external returns (bytes32 subId) {
        subId = _subscribe(planKey, msg.sender, firstChargeAt);
        _useNonce(msg.sender);
    }

    /// @notice Subscribes `subscriber` on their EIP-712 signature over
    /// `Subscribe(bytes32 planKey,address subscriber,address token,uint256 amount,uint64 periodSeconds,uint64 firstChargeAt,uint256 nonce,uint256 deadline)`
    /// with `nonce = nonces(subscriber)`. Anyone may relay it.
    /// @param terms The plan's token, amount and period, exactly as signed;
    /// anything else reverts with `TermsMismatch`. They travel as one struct
    /// because `subscribeWithPermit` would otherwise have too many arguments to
    /// decode without the IR pipeline.
    /// @param firstChargeAt When the first period is due, as signed: 0 for the
    /// subscribe time, else a time up to `MAX_FIRST_CHARGE_DELAY` ahead.
    /// @param deadline Last block timestamp (inclusive) at which `sig` is valid.
    /// @param sig An externally owned account's 65-byte `r, s, v` signature, or
    /// whatever a contract wallet accepts through EIP-1271.
    function subscribeWithAuthorization(
        bytes32 planKey,
        address subscriber,
        Terms calldata terms,
        uint64 firstChargeAt,
        uint256 deadline,
        bytes calldata sig
    ) external returns (bytes32 subId) {
        _checkTerms(planKey, terms);
        _useSubscribeAuthorization(planKey, subscriber, firstChargeAt, deadline, sig);
        return _subscribe(planKey, subscriber, firstChargeAt);
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
        Terms calldata terms,
        uint64 firstChargeAt,
        uint256 permitValue,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint256 deadline,
        bytes calldata sig
    ) external returns (bytes32 subId) {
        _checkTerms(planKey, terms);
        _permit(terms.token, subscriber, permitValue, permitDeadline, v, r, s);
        _useSubscribeAuthorization(planKey, subscriber, firstChargeAt, deadline, sig);
        return _subscribe(planKey, subscriber, firstChargeAt);
    }

    // --------------------------------------------------------------- charge

    /// @notice Pulls `amount` from the subscriber to the plan's destination.
    /// Puller only. The next due time becomes the first point of the billing
    /// grid after now: one charge per period, and a period the puller missed is
    /// skipped.
    /// @dev Checks run in this order: `Unauthorized` (not the puller, or an
    /// unknown subscription), `NotActive` (paused or cancelled), `InvalidAmount`
    /// or `AmountExceedsPlan`, then `NotDueYet`. Only `NotDueYet` means the
    /// current period has already been collected.
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

        uint64 period = plan.periodSeconds;
        uint64 nextChargeAt = dueAt + period;
        if (nextChargeAt <= block.timestamp) {
            // Charged late: skip to the first grid point after now. The cast is
            // safe because the quotient is below block.timestamp.
            // forge-lint: disable-next-line(unsafe-typecast)
            uint64 missed = uint64((block.timestamp - dueAt) / period);
            nextChargeAt = dueAt + (missed + 1) * period;
        }
        sub.nextChargeAt = nextChargeAt;
        address subscriber = sub.subscriber;
        address destination = plan.destination;
        plan.token.safeTransferFrom(subscriber, destination, amount);
        emit Charged(subId, planKey, subscriber, destination, amount, nextChargeAt);
    }

    // --------------------------------------------------------------- status

    /// @notice Ends the subscription; nothing more can be charged. Subscriber
    /// or plan owner. Uses up the subscriber's nonce, so no `Subscribe`
    /// signature handed out earlier can bring it back. The subscriber may
    /// subscribe to the plan again later.
    function cancel(bytes32 subId) external {
        Sub storage sub = _authorizedSub(subId);
        Status status = sub.status;
        if (status != Status.Active && status != Status.Paused) revert NotActive();
        sub.status = Status.Canceled;
        sub.pausedBy = PausedBy.None;
        _useNonce(sub.subscriber);
        emit Canceled(subId, msg.sender);
    }

    /// @notice Suspends charging without moving the billing grid. Subscriber or
    /// plan owner; records which of them paused.
    function pause(bytes32 subId) external {
        Sub storage sub = _authorizedSub(subId);
        if (sub.status != Status.Active) revert NotActive();
        sub.status = Status.Paused;
        sub.pausedBy = msg.sender == sub.subscriber ? PausedBy.Subscriber : PausedBy.Owner;
        emit Paused(subId, msg.sender);
    }

    /// @notice Lifts a pause. The plan owner can lift any pause; the subscriber
    /// only one they set. The billing grid does not move. If the current period
    /// has not been charged, it is due at once. Periods that passed entirely
    /// while paused are skipped.
    function resume(bytes32 subId) external {
        Sub storage sub = _authorizedSub(subId);
        if (sub.status != Status.Paused) revert NotPaused();
        if (msg.sender != plans[sub.planKey].owner && sub.pausedBy != PausedBy.Subscriber) revert Unauthorized();
        sub.status = Status.Active;
        sub.pausedBy = PausedBy.None;
        emit Resumed(subId, msg.sender, sub.nextChargeAt);
    }

    // ------------------------------------------------------------- internal

    /// @dev `firstChargeAt` 0 means now; otherwise it must be from now to
    /// `MAX_FIRST_CHARGE_DELAY` ahead.
    function _subscribe(bytes32 planKey, address subscriber, uint64 firstChargeAt) private returns (bytes32 subId) {
        if (!plans[planKey].active) revert PlanInactive();
        subId = keccak256(abi.encode(planKey, subscriber));
        Status status = subscriptions[subId].status;
        if (status == Status.Active || status == Status.Paused) revert AlreadySubscribed();

        // A uint64 of seconds lasts far beyond any block timestamp.
        uint64 nextChargeAt = firstChargeAt == 0 ? uint64(block.timestamp) : firstChargeAt;
        if (nextChargeAt < block.timestamp || nextChargeAt - block.timestamp > MAX_FIRST_CHARGE_DELAY) {
            revert InvalidFirstCharge();
        }
        subscriptions[subId] = Sub({
            planKey: planKey,
            subscriber: subscriber,
            nextChargeAt: nextChargeAt,
            status: Status.Active,
            pausedBy: PausedBy.None
        });
        emit Subscribed(subId, planKey, subscriber, nextChargeAt);
    }

    /// @dev Reverts unless the plan is active and its terms are the given ones.
    function _checkTerms(bytes32 planKey, Terms calldata terms) private view {
        Plan storage plan = plans[planKey];
        if (!plan.active) revert PlanInactive();
        if (
            address(plan.token) != address(terms.token) || plan.amount != terms.amount
                || plan.periodSeconds != terms.periodSeconds
        ) revert TermsMismatch();
    }

    /// @dev Checks the deadline and the signature over the plan's terms, and
    /// uses up the subscriber's nonce, so a signature subscribes at most once.
    function _useSubscribeAuthorization(
        bytes32 planKey,
        address subscriber,
        uint64 firstChargeAt,
        uint256 deadline,
        bytes calldata sig
    ) private {
        if (block.timestamp > deadline) revert ExpiredSignature();
        Plan storage plan = plans[planKey];
        uint256 nonce = _useNonce(subscriber);
        // forge-lint: disable-start(asm-keccak256)
        bytes32 structHash = keccak256(
            abi.encode(
                SUBSCRIBE_TYPEHASH,
                planKey,
                subscriber,
                plan.token,
                plan.amount,
                plan.periodSeconds,
                firstChargeAt,
                nonce,
                deadline
            )
        );
        // forge-lint: disable-end(asm-keccak256)
        if (!SignatureChecker.isValidSignatureNow(subscriber, _hashTypedDataV4(structHash), sig)) {
            revert InvalidSignature();
        }
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
