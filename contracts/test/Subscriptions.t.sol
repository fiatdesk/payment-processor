// SPDX-License-Identifier: Apache-2.0
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Subscriptions} from "../src/Subscriptions.sol";
import {Mock1271Wallet} from "./mocks/Mock1271Wallet.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @dev Signing helpers shared by the unit and invariant suites. The EIP-712
/// domain and the Subscribe type are rebuilt here from their parts rather than
/// read from the contract, so the tests pin what an off-chain signer must use.
abstract contract SubscriptionsSigning is Test {
    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant SUBSCRIBE_TYPEHASH = keccak256(
        "Subscribe(bytes32 planKey,address subscriber,address token,uint256 amount,uint64 periodSeconds,uint256 nonce,uint256 deadline)"
    );
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function _planTerms(Subscriptions subs, bytes32 planKey) internal view returns (Subscriptions.Terms memory terms) {
        (,,, terms.token, terms.amount, terms.periodSeconds,) = subs.plans(planKey);
    }

    function _subscribeDigest(
        Subscriptions subs,
        bytes32 planKey,
        address subscriber,
        Subscriptions.Terms memory terms,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        bytes32 domain = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("Subscriptions"), keccak256("1"), block.chainid, address(subs))
        );
        bytes32 structHash = keccak256(
            abi.encode(
                SUBSCRIBE_TYPEHASH, planKey, subscriber, terms.token, terms.amount, terms.periodSeconds, nonce, deadline
            )
        );
        return MessageHashUtils.toTypedDataHash(domain, structHash);
    }

    /// @dev Signs the plan's own terms with the subscriber's current nonce.
    function _signSubscribe(
        Subscriptions subs,
        uint256 signerKey,
        bytes32 planKey,
        address subscriber,
        uint256 deadline
    ) internal view returns (bytes memory) {
        return _signSubscribeWith(
            subs, signerKey, planKey, subscriber, _planTerms(subs, planKey), subs.nonces(subscriber), deadline
        );
    }

    function _signSubscribeWith(
        Subscriptions subs,
        uint256 signerKey,
        bytes32 planKey,
        address subscriber,
        Subscriptions.Terms memory terms,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(signerKey, _subscribeDigest(subs, planKey, subscriber, terms, nonce, deadline));
        return abi.encodePacked(r, s, v);
    }

    function _signPermit(
        MockUSDC token,
        uint256 ownerKey,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, token.nonces(owner), deadline));
        return vm.sign(ownerKey, MessageHashUtils.toTypedDataHash(token.DOMAIN_SEPARATOR(), structHash));
    }

    function _sub(Subscriptions subs, bytes32 subId) internal view returns (Subscriptions.Sub memory sub) {
        (sub.planKey, sub.subscriber, sub.nextChargeAt, sub.status, sub.pausedBy) = subs.subscriptions(subId);
    }
}

contract SubscriptionsTest is SubscriptionsSigning {
    bytes32 internal constant PLAN_ID = keccak256("price_z_monthly");
    uint256 internal constant AMOUNT = 25e6;
    uint64 internal constant PERIOD = 30 days;
    /// @dev The bounded permit the API asks for:
    /// amount * max(12, ceil(365 days / 30 days)) = 13 periods.
    uint256 internal constant PERMIT_VALUE = 13 * AMOUNT;
    /// @dev 2026-01-01T00:00:00Z, so no test runs at timestamp 0 or 1.
    uint64 internal constant START = 1_767_225_600;
    uint256 internal constant INITIAL_BALANCE = 1_000_000e6;

    MockUSDC internal usdc;
    Subscriptions internal subs;
    /// @dev The subscription operator: plan owner and puller, as in the API.
    address internal operator = makeAddr("operator");
    address internal platform = makeAddr("platform");
    address internal relayer = makeAddr("relayer");
    address internal stranger = makeAddr("stranger");
    address internal subscriber;
    uint256 internal subscriberKey;
    bytes32 internal planKey;

    function setUp() public {
        vm.warp(START);
        usdc = new MockUSDC();
        subs = new Subscriptions();
        (subscriber, subscriberKey) = makeAddrAndKey("subscriber");
        usdc.mint(subscriber, INITIAL_BALANCE);
        vm.prank(operator);
        planKey = subs.createPlan(PLAN_ID, usdc, AMOUNT, PERIOD, platform, operator);
    }

    // ---------------------------------------------------------------- plans

    function testCreatePlanStoresPlanAndDerivesKey() public {
        bytes32 planId = keccak256("price_z_weekly");
        bytes32 expectedKey = keccak256(abi.encode(operator, planId));

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.PlanCreated(expectedKey, operator, planId, address(usdc), 5e6, 7 days, platform, relayer);
        vm.prank(operator);
        bytes32 key = subs.createPlan(planId, usdc, 5e6, 7 days, platform, relayer);

        assertEq(key, expectedKey);
        (
            address owner,
            address puller,
            address destination,
            IERC20 token,
            uint256 amount,
            uint64 periodSeconds,
            bool active
        ) = subs.plans(key);
        assertEq(owner, operator);
        assertEq(puller, relayer);
        assertEq(destination, platform);
        assertEq(address(token), address(usdc));
        assertEq(amount, 5e6);
        assertEq(periodSeconds, 7 days);
        assertTrue(active);
    }

    function testSamePlanIdFromAnotherOwnerGetsAnotherKey() public {
        vm.prank(stranger);
        bytes32 key = subs.createPlan(PLAN_ID, usdc, AMOUNT, PERIOD, stranger, stranger);

        assertEq(key, keccak256(abi.encode(stranger, PLAN_ID)));
        assertTrue(key != planKey);
        (address owner,,,,,,) = subs.plans(planKey);
        assertEq(owner, operator);
    }

    function testCreatePlanTwiceReverts() public {
        vm.expectRevert(Subscriptions.PlanExists.selector);
        vm.prank(operator);
        subs.createPlan(PLAN_ID, usdc, 1, 1 days, stranger, stranger);

        (,, address destination,, uint256 amount, uint64 periodSeconds,) = subs.plans(planKey);
        assertEq(destination, platform);
        assertEq(amount, AMOUNT);
        assertEq(periodSeconds, PERIOD);
    }

    function testCreatePlanRejectsZeroPeriod() public {
        vm.expectRevert(Subscriptions.InvalidPeriod.selector);
        vm.prank(operator);
        subs.createPlan(keccak256("p"), usdc, AMOUNT, 0, platform, operator);
    }

    function testCreatePlanRejectsPeriodOverTenYears() public {
        uint64 max = subs.MAX_PERIOD_SECONDS();
        assertEq(max, 10 * 365 days);

        vm.expectRevert(Subscriptions.InvalidPeriod.selector);
        vm.prank(operator);
        subs.createPlan(keccak256("p"), usdc, AMOUNT, max + 1, platform, operator);

        vm.prank(operator);
        bytes32 key = subs.createPlan(keccak256("p"), usdc, AMOUNT, max, platform, operator);
        (,,,,, uint64 periodSeconds,) = subs.plans(key);
        assertEq(periodSeconds, max);
    }

    function testCreatePlanRejectsZeroAmount() public {
        vm.expectRevert(Subscriptions.InvalidAmount.selector);
        vm.prank(operator);
        subs.createPlan(keccak256("p"), usdc, 0, PERIOD, platform, operator);
    }

    function testCreatePlanRejectsZeroAddresses() public {
        vm.startPrank(operator);
        vm.expectRevert(Subscriptions.ZeroAddress.selector);
        subs.createPlan(keccak256("p"), IERC20(address(0)), AMOUNT, PERIOD, platform, operator);
        vm.expectRevert(Subscriptions.ZeroAddress.selector);
        subs.createPlan(keccak256("p"), usdc, AMOUNT, PERIOD, address(0), operator);
        vm.expectRevert(Subscriptions.ZeroAddress.selector);
        subs.createPlan(keccak256("p"), usdc, AMOUNT, PERIOD, platform, address(0));
        vm.stopPrank();
    }

    function testOnlyOwnerChangesPlan() public {
        vm.startPrank(stranger);
        vm.expectRevert(Subscriptions.Unauthorized.selector);
        subs.setPlanDestination(planKey, stranger);
        vm.expectRevert(Subscriptions.Unauthorized.selector);
        subs.setPlanPuller(planKey, stranger);
        vm.expectRevert(Subscriptions.Unauthorized.selector);
        subs.deactivatePlan(planKey);
        vm.stopPrank();

        // The puller is not the owner and has no say over the plan either.
        vm.prank(operator);
        subs.setPlanPuller(planKey, relayer);
        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(relayer);
        subs.setPlanDestination(planKey, relayer);

        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(operator);
        subs.setPlanDestination(keccak256("no such plan"), operator);
    }

    function testPlanSettersRejectZeroAddresses() public {
        vm.startPrank(operator);
        vm.expectRevert(Subscriptions.ZeroAddress.selector);
        subs.setPlanDestination(planKey, address(0));
        vm.expectRevert(Subscriptions.ZeroAddress.selector);
        subs.setPlanPuller(planKey, address(0));
        vm.stopPrank();
    }

    function testSetPlanDestinationRedirectsCharges() public {
        bytes32 subId = _subscribe(planKey);
        address treasury = makeAddr("treasury");

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.PlanDestinationSet(planKey, treasury);
        vm.prank(operator);
        subs.setPlanDestination(planKey, treasury);

        _charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(treasury), AMOUNT);
        assertEq(usdc.balanceOf(platform), 0);
    }

    function testSetPlanPullerMovesTheRightToCharge() public {
        bytes32 subId = _subscribe(planKey);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.PlanPullerSet(planKey, relayer);
        vm.prank(operator);
        subs.setPlanPuller(planKey, relayer);

        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);

        vm.prank(relayer);
        subs.charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(platform), AMOUNT);
    }

    function testDeactivatePlanBlocksNewSubscribes() public {
        bytes32 existing = _subscribe(planKey);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.PlanDeactivated(planKey);
        vm.prank(operator);
        subs.deactivatePlan(planKey);
        (,,,,,, bool active) = subs.plans(planKey);
        assertFalse(active);

        (address other, uint256 otherKey) = makeAddrAndKey("other-subscriber");
        vm.expectRevert(Subscriptions.PlanInactive.selector);
        vm.prank(other);
        subs.subscribe(planKey);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, otherKey, planKey, other, deadline);
        vm.expectRevert(Subscriptions.PlanInactive.selector);
        _relay(planKey, other, deadline, sig);

        // Existing subscriptions keep billing.
        _charge(existing, AMOUNT);
        assertEq(usdc.balanceOf(platform), AMOUNT);

        vm.expectRevert(Subscriptions.PlanInactive.selector);
        vm.prank(operator);
        subs.deactivatePlan(planKey);
    }

    // ------------------------------------------------------------ subscribe

    function testSubscribeBySubscriber() public {
        bytes32 expectedId = keccak256(abi.encode(planKey, subscriber));
        vm.prank(subscriber);
        usdc.approve(address(subs), PERMIT_VALUE);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Subscribed(expectedId, planKey, subscriber, START);
        vm.prank(subscriber);
        bytes32 subId = subs.subscribe(planKey);

        assertEq(subId, expectedId);
        Subscriptions.Sub memory sub = _sub(subs, subId);
        assertEq(sub.planKey, planKey);
        assertEq(sub.subscriber, subscriber);
        assertEq(sub.nextChargeAt, START);
        assertEq(uint8(sub.status), uint8(Subscriptions.Status.Active));
        assertEq(uint8(sub.pausedBy), uint8(Subscriptions.PausedBy.None));
        // Subscribing moves no money; it uses up the subscriber's nonce.
        assertEq(usdc.balanceOf(subscriber), INITIAL_BALANCE);
        assertEq(subs.nonces(subscriber), 1);
    }

    function testUnknownSubscriptionIsNone() public view {
        Subscriptions.Sub memory sub = _sub(subs, keccak256(abi.encode(planKey, subscriber)));
        assertEq(sub.planKey, bytes32(0));
        assertEq(sub.subscriber, address(0));
        assertEq(sub.nextChargeAt, 0);
        assertEq(uint8(sub.status), uint8(Subscriptions.Status.None));
        assertEq(uint8(sub.pausedBy), uint8(Subscriptions.PausedBy.None));
    }

    function testSubscribeToUnknownPlanReverts() public {
        vm.expectRevert(Subscriptions.PlanInactive.selector);
        vm.prank(subscriber);
        subs.subscribe(keccak256("no such plan"));
    }

    function testSubscribeTwiceReverts() public {
        bytes32 subId = _subscribe(planKey);

        vm.expectRevert(Subscriptions.AlreadySubscribed.selector);
        vm.prank(subscriber);
        subs.subscribe(planKey);

        vm.prank(subscriber);
        subs.pause(subId);
        vm.expectRevert(Subscriptions.AlreadySubscribed.selector);
        vm.prank(subscriber);
        subs.subscribe(planKey);
    }

    function testResubscribeAfterCancelStartsAFreshSchedule() public {
        bytes32 subId = _subscribe(planKey);
        _charge(subId, AMOUNT);
        vm.prank(subscriber);
        subs.cancel(subId);

        vm.warp(START + 3 days);
        vm.prank(subscriber);
        bytes32 again = subs.subscribe(planKey);

        assertEq(again, subId);
        Subscriptions.Sub memory sub = _sub(subs, subId);
        assertEq(sub.nextChargeAt, START + 3 days);
        assertEq(uint8(sub.status), uint8(Subscriptions.Status.Active));
        _charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(platform), 2 * AMOUNT);
        assertEq(_sub(subs, subId).nextChargeAt, START + 3 days + PERIOD);
    }

    /// @dev Reviewer PoC: a signature handed out before a direct subscribe used
    /// to bring the subscription back after a cancel.
    function testDirectSubscribeAndCancelRetireOutstandingSignatures() public {
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        bytes32 subId = _subscribe(planKey);
        assertEq(subs.nonces(subscriber), 1);
        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        _relay(planKey, subscriber, deadline, sig);

        _charge(subId, AMOUNT);
        vm.prank(subscriber);
        subs.cancel(subId);
        assertEq(subs.nonces(subscriber), 2);

        vm.warp(block.timestamp + 12 hours);
        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        _relay(planKey, subscriber, deadline, sig);

        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Canceled));
        assertEq(usdc.balanceOf(platform), AMOUNT);
    }

    /// @dev Reviewer PoC: a relay that reverted published its signature without
    /// using the nonce; an owner cancel must still retire it.
    function testCancelRetiresASignatureLeakedByARevertedRelay() public {
        uint256 deadline = block.timestamp + 1 days;
        _approve(PERMIT_VALUE);
        bytes32 subId =
            _relay(planKey, subscriber, deadline, _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline));
        bytes memory leaked = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        vm.expectRevert(Subscriptions.AlreadySubscribed.selector);
        _relay(planKey, subscriber, deadline, leaked);
        assertEq(subs.nonces(subscriber), 1);

        vm.prank(operator);
        subs.cancel(subId);
        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        vm.prank(stranger);
        subs.subscribeWithAuthorization(planKey, subscriber, _terms(), deadline, leaked);

        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Canceled));
    }

    // ------------------------------------------- subscribeWithAuthorization

    function testSubscribeWithAuthorizationRelayedByThirdParty() public {
        _approve(PERMIT_VALUE);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);
        uint256 relayerBalance = usdc.balanceOf(relayer);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Subscribed(keccak256(abi.encode(planKey, subscriber)), planKey, subscriber, START);
        bytes32 subId = _relay(planKey, subscriber, deadline, sig);

        Subscriptions.Sub memory sub = _sub(subs, subId);
        assertEq(sub.subscriber, subscriber);
        assertEq(uint8(sub.status), uint8(Subscriptions.Status.Active));
        assertEq(subs.nonces(subscriber), 1);
        assertEq(usdc.balanceOf(relayer), relayerBalance);
    }

    function testSubscribeTypehashAndDomain() public view {
        assertEq(
            subs.SUBSCRIBE_TYPEHASH(),
            keccak256(
                "Subscribe(bytes32 planKey,address subscriber,address token,uint256 amount,uint64 periodSeconds,uint256 nonce,uint256 deadline)"
            )
        );
        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) =
            subs.eip712Domain();
        assertEq(name, "Subscriptions");
        assertEq(version, "1");
        assertEq(chainId, block.chainid);
        assertEq(verifyingContract, address(subs));
    }

    function testSubscribeWithAuthorizationAfterDeadlineReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        vm.warp(deadline + 1);
        vm.expectRevert(Subscriptions.ExpiredSignature.selector);
        _relay(planKey, subscriber, deadline, sig);
    }

    function testSubscribeWithAuthorizationAtDeadlineSucceeds() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        vm.warp(deadline);
        bytes32 subId = _relay(planKey, subscriber, deadline, sig);

        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Active));
    }

    function testSubscribeWithAuthorizationRejectsAnotherSigner() public {
        (, uint256 strangerKey) = makeAddrAndKey("signing-stranger");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, strangerKey, planKey, subscriber, deadline);

        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        _relay(planKey, subscriber, deadline, sig);
    }

    function testSubscribeWithAuthorizationRejectsMalformedSignature() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        _relay(planKey, subscriber, deadline, hex"1234");
    }

    /// @dev Reviewer PoC: the malleated twin (n - s, flipped v) of a valid
    /// signature is rejected; the original still works.
    function testSubscribeWithAuthorizationRejectsHighSSignature() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = _subscribeDigest(subs, planKey, subscriber, _terms(), 0, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(subscriberKey, digest);
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes memory malleated = abi.encodePacked(r, bytes32(n - uint256(s)), v == 27 ? uint8(28) : uint8(27));

        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        _relay(planKey, subscriber, deadline, malleated);

        _relay(planKey, subscriber, deadline, abi.encodePacked(r, s, v));
        assertEq(subs.nonces(subscriber), 1);
    }

    function testSubscribeRejectsTermsThatDifferFromThePlan() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);
        Subscriptions.Terms[3] memory wrong = [
            Subscriptions.Terms(IERC20(makeAddr("other-token")), AMOUNT, PERIOD),
            Subscriptions.Terms(usdc, AMOUNT + 1, PERIOD),
            Subscriptions.Terms(usdc, AMOUNT, PERIOD - 1)
        ];

        for (uint256 i; i < wrong.length; ++i) {
            vm.expectRevert(Subscriptions.TermsMismatch.selector);
            vm.prank(relayer);
            subs.subscribeWithAuthorization(planKey, subscriber, wrong[i], deadline, sig);
        }

        // A signature over other terms fails even when the calldata states the
        // plan's own terms.
        bytes memory other =
            _signSubscribeWith(subs, subscriberKey, planKey, subscriber, wrong[1], subs.nonces(subscriber), deadline);
        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        _relay(planKey, subscriber, deadline, other);
        assertEq(subs.nonces(subscriber), 0);
    }

    function testSignatureForOnePlanCannotSubscribeToAPlanWithOtherTerms() public {
        vm.prank(operator);
        bytes32 pricier = subs.createPlan(keccak256("pricier"), usdc, 2 * AMOUNT, PERIOD, platform, operator);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        vm.startPrank(relayer);
        vm.expectRevert(Subscriptions.TermsMismatch.selector);
        subs.subscribeWithAuthorization(pricier, subscriber, _terms(), deadline, sig);
        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        subs.subscribeWithAuthorization(
            pricier, subscriber, Subscriptions.Terms(usdc, 2 * AMOUNT, PERIOD), deadline, sig
        );
        vm.stopPrank();
    }

    function testSignatureForOnePlanCannotSubscribeToAPlanWithTheSameTerms() public {
        vm.prank(operator);
        bytes32 twin = subs.createPlan(keccak256("twin"), usdc, AMOUNT, PERIOD, platform, operator);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        _relay(twin, subscriber, deadline, sig);
        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        _relay(planKey, subscriber, deadline + 1, sig);
    }

    function testSubscribeWithAuthorizationCannotBeReplayedAfterCancel() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);
        bytes32 subId = _relay(planKey, subscriber, deadline, sig);
        vm.prank(subscriber);
        subs.cancel(subId);

        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        _relay(planKey, subscriber, deadline, sig);

        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Canceled));
    }

    function testContractWalletSubscribesWithAnEip1271Signature() public {
        (address walletSigner, uint256 walletKey) = makeAddrAndKey("wallet-signer");
        Mock1271Wallet wallet = new Mock1271Wallet(walletSigner);
        usdc.mint(address(wallet), 1_000e6);
        vm.prank(address(wallet));
        usdc.approve(address(subs), PERMIT_VALUE);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, walletKey, planKey, address(wallet), deadline);

        bytes32 subId = _relay(planKey, address(wallet), deadline, sig);

        assertEq(subId, keccak256(abi.encode(planKey, address(wallet))));
        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Active));
        _charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(address(wallet)), 1_000e6 - AMOUNT);
    }

    function testContractWalletSignatureItRejectsReverts() public {
        Mock1271Wallet wallet = new Mock1271Wallet(makeAddr("wallet-signer"));
        (, uint256 strangerKey) = makeAddrAndKey("signing-stranger");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, strangerKey, planKey, address(wallet), deadline);

        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        _relay(planKey, address(wallet), deadline, sig);
        assertEq(subs.nonces(address(wallet)), 0);
    }

    /// @dev Reviewer PoC, bounded: a Subscribe signature phished for an attacker's
    /// plan (huge amount, 1-second period) spends at most the remaining allowance.
    function testPhishedSignatureSpendsAtMostTheRemainingAllowance() public {
        _approve(PERMIT_VALUE);
        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        bytes32 evil = subs.createPlan(keccak256("evil"), usdc, type(uint128).max, 1, attacker, attacker);
        uint256 deadline = block.timestamp + 1 hours;
        // The signed message names the attacker's amount and period.
        bytes memory sig = _signSubscribe(subs, subscriberKey, evil, subscriber, deadline);

        vm.startPrank(attacker);
        bytes32 subId = subs.subscribeWithAuthorization(evil, subscriber, _planTerms(subs, evil), deadline, sig);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, address(subs), PERMIT_VALUE, INITIAL_BALANCE
            )
        );
        subs.charge(subId, INITIAL_BALANCE);
        subs.charge(subId, PERMIT_VALUE);
        vm.warp(block.timestamp + 1);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(subs), 0, 1));
        subs.charge(subId, 1);
        vm.stopPrank();

        assertEq(usdc.balanceOf(subscriber), INITIAL_BALANCE - PERMIT_VALUE);
    }

    // -------------------------------------------------- subscribeWithPermit

    function testSubscribeWithPermitRelayedByThirdParty() public {
        assertEq(usdc.allowance(subscriber, address(subs)), 0);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, subscriberKey, subscriber, address(subs), PERMIT_VALUE, deadline);
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        vm.prank(relayer);
        bytes32 subId =
            subs.subscribeWithPermit(planKey, subscriber, _terms(), PERMIT_VALUE, deadline, v, r, s, deadline, sig);

        assertEq(usdc.allowance(subscriber, address(subs)), PERMIT_VALUE);
        assertEq(usdc.nonces(subscriber), 1);
        assertEq(subs.nonces(subscriber), 1);
        Subscriptions.Sub memory sub = _sub(subs, subId);
        assertEq(sub.subscriber, subscriber);
        assertEq(uint8(sub.status), uint8(Subscriptions.Status.Active));

        // The first period is due at once and comes out of the bounded allowance.
        _charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(platform), AMOUNT);
        assertEq(usdc.balanceOf(subscriber), INITIAL_BALANCE - AMOUNT);
        assertEq(usdc.allowance(subscriber, address(subs)), PERMIT_VALUE - AMOUNT);
    }

    function testSubscribeWithPermitSurvivesAFrontRunPermit() public {
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, subscriberKey, subscriber, address(subs), PERMIT_VALUE, deadline);
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        // Someone copies the permit out of the mempool and submits it first.
        vm.prank(stranger);
        usdc.permit(subscriber, address(subs), PERMIT_VALUE, deadline, v, r, s);

        vm.prank(relayer);
        bytes32 subId =
            subs.subscribeWithPermit(planKey, subscriber, _terms(), PERMIT_VALUE, deadline, v, r, s, deadline, sig);

        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Active));
        assertEq(usdc.allowance(subscriber, address(subs)), PERMIT_VALUE);
    }

    function testSubscribeWithPermitRevertsOnABadPermitWithoutAllowance() public {
        (, uint256 strangerKey) = makeAddrAndKey("signing-stranger");
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, strangerKey, subscriber, address(subs), PERMIT_VALUE, deadline);
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        vm.expectRevert(bytes("EIP2612: invalid signature"));
        vm.prank(relayer);
        subs.subscribeWithPermit(planKey, subscriber, _terms(), PERMIT_VALUE, deadline, v, r, s, deadline, sig);

        assertEq(subs.nonces(subscriber), 0);
        assertEq(uint8(_sub(subs, keccak256(abi.encode(planKey, subscriber))).status), uint8(Subscriptions.Status.None));
    }

    function testSubscribeWithPermitRollsBackThePermitOnABadSubscribeSignature() public {
        (, uint256 strangerKey) = makeAddrAndKey("signing-stranger");
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, subscriberKey, subscriber, address(subs), PERMIT_VALUE, deadline);
        bytes memory sig = _signSubscribe(subs, strangerKey, planKey, subscriber, deadline);

        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        vm.prank(relayer);
        subs.subscribeWithPermit(planKey, subscriber, _terms(), PERMIT_VALUE, deadline, v, r, s, deadline, sig);

        assertEq(usdc.allowance(subscriber, address(subs)), 0);
        assertEq(usdc.nonces(subscriber), 0);
    }

    function testSubscribeWithPermitRejectsMismatchedTermsBeforeThePermit() public {
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, subscriberKey, subscriber, address(subs), PERMIT_VALUE, deadline);
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        vm.expectRevert(Subscriptions.TermsMismatch.selector);
        vm.prank(relayer);
        subs.subscribeWithPermit(
            planKey,
            subscriber,
            Subscriptions.Terms(usdc, AMOUNT + 1, PERIOD),
            PERMIT_VALUE,
            deadline,
            v,
            r,
            s,
            deadline,
            sig
        );
        assertEq(usdc.allowance(subscriber, address(subs)), 0);
    }

    function testSubscribeWithPermitToInactivePlanReverts() public {
        vm.prank(operator);
        subs.deactivatePlan(planKey);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, subscriberKey, subscriber, address(subs), PERMIT_VALUE, deadline);
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        vm.expectRevert(Subscriptions.PlanInactive.selector);
        vm.prank(relayer);
        subs.subscribeWithPermit(planKey, subscriber, _terms(), PERMIT_VALUE, deadline, v, r, s, deadline, sig);
        assertEq(usdc.allowance(subscriber, address(subs)), 0);
    }

    /// @dev Reviewer PoC: a zero-value permit is a no-op, but the Subscribe
    /// signature is still required.
    function testZeroValuePermitStillNeedsTheSubscribeSignature() public {
        _approve(PERMIT_VALUE);
        (, uint256 otherKey) = makeAddrAndKey("other");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory bad = _signSubscribe(subs, otherKey, planKey, subscriber, deadline);
        bytes memory good = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);

        vm.startPrank(stranger);
        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        subs.subscribeWithPermit(planKey, subscriber, _terms(), 0, 0, 0, bytes32(0), bytes32(0), deadline, bad);
        bytes32 subId =
            subs.subscribeWithPermit(planKey, subscriber, _terms(), 0, 0, 0, bytes32(0), bytes32(0), deadline, good);
        vm.stopPrank();

        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Active));
        assertEq(usdc.allowance(subscriber, address(subs)), PERMIT_VALUE);
    }

    // --------------------------------------------------------------- charge

    function testChargeSucceedsImmediatelyAfterSubscribe() public {
        bytes32 subId = _subscribe(planKey);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Charged(subId, planKey, subscriber, platform, AMOUNT, START + PERIOD);
        _charge(subId, AMOUNT);

        assertEq(usdc.balanceOf(platform), AMOUNT);
        assertEq(usdc.balanceOf(subscriber), INITIAL_BALANCE - AMOUNT);
        assertEq(usdc.balanceOf(address(subs)), 0);
        assertEq(_sub(subs, subId).nextChargeAt, START + PERIOD);
    }

    function testChargeBeforeThePeriodElapsesRevertsNotDueYet() public {
        bytes32 subId = _subscribe(planKey);
        _charge(subId, AMOUNT);

        vm.expectRevert(Subscriptions.NotDueYet.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);

        vm.warp(START + PERIOD - 1);
        vm.expectRevert(Subscriptions.NotDueYet.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);

        assertEq(usdc.balanceOf(platform), AMOUNT);
    }

    function testChargeExactlyOnePeriodLaterMovesOnePeriod() public {
        bytes32 subId = _subscribe(planKey);
        _charge(subId, AMOUNT);

        uint64 dueAt = START + PERIOD;
        vm.warp(dueAt + PERIOD);
        _charge(subId, AMOUNT);

        assertEq(_sub(subs, subId).nextChargeAt, dueAt + 2 * PERIOD);
    }

    function testLateChargeKeepsTheBillingGrid() public {
        bytes32 subId = _subscribe(planKey);
        _charge(subId, AMOUNT);

        // Due at START + PERIOD, charged half a period after the next one began.
        uint64 dueAt = START + PERIOD;
        vm.warp(dueAt + PERIOD + PERIOD / 2);
        _charge(subId, AMOUNT);
        assertEq(_sub(subs, subId).nextChargeAt, dueAt + 2 * PERIOD);

        vm.expectRevert(Subscriptions.NotDueYet.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);

        // A charge a few hours late moves to the next grid point, not "now + period".
        vm.warp(dueAt + 2 * PERIOD + 5 hours);
        _charge(subId, AMOUNT);
        assertEq(_sub(subs, subId).nextChargeAt, dueAt + 3 * PERIOD);
        assertEq(usdc.balanceOf(platform), 3 * AMOUNT);
    }

    /// @dev Reviewer PoC: a schedule one period behind used to allow two
    /// charges in one block.
    function testMissedPeriodsAreSkippedNotCollected() public {
        bytes32 subId = _subscribe(planKey);

        vm.warp(START + PERIOD + 1);
        _charge(subId, AMOUNT);
        vm.expectRevert(Subscriptions.NotDueYet.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);
        assertEq(_sub(subs, subId).nextChargeAt, START + 2 * PERIOD);

        // Three more periods pass without a charge: only the current one is collected.
        vm.warp(START + 5 * uint256(PERIOD) + 7);
        _charge(subId, AMOUNT);
        vm.expectRevert(Subscriptions.NotDueYet.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);

        assertEq(usdc.balanceOf(platform), 2 * AMOUNT);
        assertEq(_sub(subs, subId).nextChargeAt, START + 6 * PERIOD);
    }

    function testChargeAboveThePlanAmountReverts() public {
        bytes32 subId = _subscribe(planKey);

        vm.expectRevert(Subscriptions.AmountExceedsPlan.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT + 1);

        assertEq(_sub(subs, subId).nextChargeAt, START);
        assertEq(usdc.balanceOf(subscriber), INITIAL_BALANCE);
    }

    function testChargeBelowThePlanAmountUsesThePeriod() public {
        bytes32 subId = _subscribe(planKey);

        _charge(subId, AMOUNT - 1);

        assertEq(usdc.balanceOf(platform), AMOUNT - 1);
        vm.expectRevert(Subscriptions.NotDueYet.selector);
        vm.prank(operator);
        subs.charge(subId, 1);
    }

    function testChargeOfZeroReverts() public {
        bytes32 subId = _subscribe(planKey);

        vm.expectRevert(Subscriptions.InvalidAmount.selector);
        vm.prank(operator);
        subs.charge(subId, 0);
    }

    /// @dev Reviewer PoC: when several checks fail at once, the first in
    /// Unauthorized, NotActive, InvalidAmount/AmountExceedsPlan, NotDueYet wins.
    function testChargeChecksRunInOrder() public {
        bytes32 subId = _subscribe(planKey);
        _charge(subId, AMOUNT); // The current period is collected.

        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(stranger);
        subs.charge(subId, AMOUNT + 1);

        vm.startPrank(operator);
        vm.expectRevert(Subscriptions.AmountExceedsPlan.selector);
        subs.charge(subId, AMOUNT + 1);
        vm.expectRevert(Subscriptions.InvalidAmount.selector);
        subs.charge(subId, 0);
        vm.expectRevert(Subscriptions.NotDueYet.selector);
        subs.charge(subId, AMOUNT);
        vm.stopPrank();

        vm.prank(subscriber);
        subs.pause(subId);
        vm.startPrank(operator);
        vm.expectRevert(Subscriptions.NotActive.selector);
        subs.charge(subId, AMOUNT + 1);
        vm.expectRevert(Subscriptions.NotActive.selector);
        subs.charge(subId, 0);
        vm.stopPrank();

        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(stranger);
        subs.charge(subId, AMOUNT);
    }

    function testOnlyThePullerCanCharge() public {
        vm.prank(operator);
        bytes32 key = subs.createPlan(keccak256("split roles"), usdc, AMOUNT, PERIOD, platform, relayer);
        bytes32 subId = _subscribe(key);

        address[3] memory callers = [stranger, subscriber, operator];
        for (uint256 i; i < callers.length; ++i) {
            vm.expectRevert(Subscriptions.Unauthorized.selector);
            vm.prank(callers[i]);
            subs.charge(subId, AMOUNT);
        }

        vm.prank(relayer);
        subs.charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(platform), AMOUNT);
    }

    function testChargeOfAnUnknownSubscriptionReverts() public {
        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(operator);
        subs.charge(keccak256("no such subscription"), AMOUNT);
    }

    function testRevokedAllowanceStopsCharges() public {
        bytes32 subId = _subscribe(planKey);
        _approve(0);

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(subs), 0, AMOUNT)
        );
        vm.prank(operator);
        subs.charge(subId, AMOUNT);

        Subscriptions.Sub memory sub = _sub(subs, subId);
        assertEq(sub.nextChargeAt, START);
        assertEq(uint8(sub.status), uint8(Subscriptions.Status.Active));
        assertEq(usdc.balanceOf(subscriber), INITIAL_BALANCE);
    }

    function testTransferFailureLeavesTheScheduleAlone() public {
        bytes32 subId = _subscribe(planKey);
        usdc.blacklist(subscriber, true);

        vm.expectRevert(bytes("Blacklistable: account is blacklisted"));
        vm.prank(operator);
        subs.charge(subId, AMOUNT);

        usdc.blacklist(subscriber, false);
        _charge(subId, AMOUNT);
        assertEq(_sub(subs, subId).nextChargeAt, START + PERIOD);
    }

    function testBlacklistedDestinationBlocksChargesUntilRotated() public {
        bytes32 subId = _subscribe(planKey);
        usdc.blacklist(platform, true);

        vm.expectRevert(bytes("Blacklistable: account is blacklisted"));
        vm.prank(operator);
        subs.charge(subId, AMOUNT);
        assertEq(_sub(subs, subId).nextChargeAt, START);

        address treasury = makeAddr("treasury");
        vm.prank(operator);
        subs.setPlanDestination(planKey, treasury);
        _charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(treasury), AMOUNT);
    }

    // --------------------------------------------------------------- cancel

    function testCancelBySubscriber() public {
        bytes32 subId = _subscribe(planKey);
        uint256 nonce = subs.nonces(subscriber);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Canceled(subId, subscriber);
        vm.prank(subscriber);
        subs.cancel(subId);

        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Canceled));
        assertEq(subs.nonces(subscriber), nonce + 1);
        vm.expectRevert(Subscriptions.NotActive.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);
    }

    function testCancelByPlanOwner() public {
        bytes32 subId = _subscribe(planKey);
        uint256 nonce = subs.nonces(subscriber);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Canceled(subId, operator);
        vm.prank(operator);
        subs.cancel(subId);

        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Canceled));
        // The subscriber's nonce moves, not the owner's.
        assertEq(subs.nonces(subscriber), nonce + 1);
        assertEq(subs.nonces(operator), 0);
    }

    function testCancelByStrangerOrPullerReverts() public {
        vm.prank(operator);
        bytes32 key = subs.createPlan(keccak256("split roles"), usdc, AMOUNT, PERIOD, platform, relayer);
        bytes32 subId = _subscribe(key);

        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(stranger);
        subs.cancel(subId);
        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(relayer);
        subs.cancel(subId);

        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Active));
    }

    function testCancelPausedSubscription() public {
        bytes32 subId = _subscribe(planKey);
        vm.startPrank(subscriber);
        subs.pause(subId);
        subs.cancel(subId);
        vm.stopPrank();

        Subscriptions.Sub memory sub = _sub(subs, subId);
        assertEq(uint8(sub.status), uint8(Subscriptions.Status.Canceled));
        assertEq(uint8(sub.pausedBy), uint8(Subscriptions.PausedBy.None));
        vm.expectRevert(Subscriptions.NotPaused.selector);
        vm.prank(subscriber);
        subs.resume(subId);
    }

    function testCancelTwiceOrUnknownReverts() public {
        bytes32 subId = _subscribe(planKey);
        vm.prank(subscriber);
        subs.cancel(subId);

        vm.expectRevert(Subscriptions.NotActive.selector);
        vm.prank(subscriber);
        subs.cancel(subId);

        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(operator);
        subs.cancel(keccak256("no such subscription"));
    }

    // --------------------------------------------------------- pause/resume

    function testPauseBlocksCharge() public {
        bytes32 subId = _subscribe(planKey);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Paused(subId, subscriber);
        vm.prank(subscriber);
        subs.pause(subId);

        assertEq(uint8(_sub(subs, subId).pausedBy), uint8(Subscriptions.PausedBy.Subscriber));
        vm.expectRevert(Subscriptions.NotActive.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(platform), 0);
    }

    function testResumeKeepsTheBillingGrid() public {
        bytes32 subId = _subscribe(planKey);
        _charge(subId, AMOUNT);
        vm.prank(subscriber);
        subs.pause(subId);

        vm.warp(START + PERIOD / 2);
        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Resumed(subId, subscriber, START + PERIOD);
        vm.prank(subscriber);
        subs.resume(subId);

        Subscriptions.Sub memory sub = _sub(subs, subId);
        assertEq(sub.nextChargeAt, START + PERIOD);
        assertEq(uint8(sub.status), uint8(Subscriptions.Status.Active));
        vm.expectRevert(Subscriptions.NotDueYet.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);

        vm.warp(START + PERIOD);
        _charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(platform), 2 * AMOUNT);
    }

    function testPauseAndResumeRightAfterSubscribeLeavesTheFirstChargeDue() public {
        bytes32 subId = _subscribe(planKey);

        vm.startPrank(subscriber);
        subs.pause(subId);
        subs.resume(subId);
        vm.stopPrank();

        assertEq(_sub(subs, subId).nextChargeAt, START);
        _charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(platform), AMOUNT);
    }

    function testPausingAcrossADueTimeMakesTheChargeDueOnResume() public {
        bytes32 subId = _subscribe(planKey);
        _charge(subId, AMOUNT);
        vm.prank(subscriber);
        subs.pause(subId);

        vm.warp(START + PERIOD + 5 days);
        vm.prank(subscriber);
        subs.resume(subId);

        _charge(subId, AMOUNT);
        assertEq(_sub(subs, subId).nextChargeAt, START + 2 * PERIOD);
        vm.expectRevert(Subscriptions.NotDueYet.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);
    }

    function testPeriodsThatPassWhilePausedAreSkipped() public {
        bytes32 subId = _subscribe(planKey);
        _charge(subId, AMOUNT);
        vm.prank(subscriber);
        subs.pause(subId);

        // Paused through the second, third and fourth periods.
        vm.warp(START + 3 * uint256(PERIOD) + PERIOD / 2);
        vm.prank(subscriber);
        subs.resume(subId);

        _charge(subId, AMOUNT);
        vm.expectRevert(Subscriptions.NotDueYet.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);
        assertEq(_sub(subs, subId).nextChargeAt, START + 4 * PERIOD);
        assertEq(usdc.balanceOf(platform), 2 * AMOUNT);
    }

    /// @dev Reviewer PoC: pausing and resuming just before each due time used
    /// to give six periods of service for one charge.
    function testPauseResumeAroundEachDueTimeKeepsEveryCharge() public {
        bytes32 subId = _subscribe(planKey);
        _charge(subId, AMOUNT);

        for (uint256 i; i < 6; ++i) {
            uint64 dueAt = _sub(subs, subId).nextChargeAt;
            vm.warp(dueAt - 60);
            vm.startPrank(subscriber);
            subs.pause(subId);
            subs.resume(subId);
            vm.stopPrank();
            vm.warp(dueAt);
            _charge(subId, AMOUNT);
        }

        assertEq(usdc.balanceOf(platform), 7 * AMOUNT);
        assertEq(_sub(subs, subId).nextChargeAt, START + 7 * PERIOD);
    }

    function testSubscriberCannotResumeAnOwnerPause() public {
        bytes32 subId = _subscribe(planKey);
        vm.prank(operator);
        subs.pause(subId);
        assertEq(uint8(_sub(subs, subId).pausedBy), uint8(Subscriptions.PausedBy.Owner));

        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(subscriber);
        subs.resume(subId);

        // The subscriber can still leave.
        vm.prank(subscriber);
        subs.cancel(subId);
        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Canceled));
    }

    function testOwnerCanResumeEitherKindOfPause() public {
        bytes32 subId = _subscribe(planKey);

        vm.prank(subscriber);
        subs.pause(subId);
        vm.prank(operator);
        subs.resume(subId);
        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Active));

        vm.startPrank(operator);
        subs.pause(subId);
        subs.resume(subId);
        vm.stopPrank();
        assertEq(uint8(_sub(subs, subId).status), uint8(Subscriptions.Status.Active));
    }

    function testPausedByResetsOnResumeAndCancel() public {
        bytes32 subId = _subscribe(planKey);

        vm.prank(subscriber);
        subs.pause(subId);
        assertEq(uint8(_sub(subs, subId).pausedBy), uint8(Subscriptions.PausedBy.Subscriber));
        vm.prank(subscriber);
        subs.resume(subId);
        assertEq(uint8(_sub(subs, subId).pausedBy), uint8(Subscriptions.PausedBy.None));

        vm.prank(operator);
        subs.pause(subId);
        assertEq(uint8(_sub(subs, subId).pausedBy), uint8(Subscriptions.PausedBy.Owner));
        vm.prank(operator);
        subs.cancel(subId);
        assertEq(uint8(_sub(subs, subId).pausedBy), uint8(Subscriptions.PausedBy.None));
    }

    function testStrangerCannotPauseOrResume() public {
        bytes32 subId = _subscribe(planKey);

        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(stranger);
        subs.pause(subId);

        vm.prank(subscriber);
        subs.pause(subId);
        vm.expectRevert(Subscriptions.Unauthorized.selector);
        vm.prank(stranger);
        subs.resume(subId);
    }

    function testPauseAndResumeNeedTheRightState() public {
        bytes32 subId = _subscribe(planKey);

        vm.expectRevert(Subscriptions.NotPaused.selector);
        vm.prank(subscriber);
        subs.resume(subId);

        vm.startPrank(subscriber);
        subs.pause(subId);
        vm.expectRevert(Subscriptions.NotActive.selector);
        subs.pause(subId);
        subs.cancel(subId);
        vm.expectRevert(Subscriptions.NotActive.selector);
        subs.pause(subId);
        vm.stopPrank();
    }

    // ----------------------------------------------------------------- fuzz

    function testFuzzChargeSchedule(uint64 period, uint8 cycles) public {
        period = uint64(bound(period, 1, subs.MAX_PERIOD_SECONDS()));
        uint256 n = bound(cycles, 1, type(uint8).max);
        vm.prank(operator);
        bytes32 key = subs.createPlan(keccak256("fuzz"), usdc, AMOUNT, period, platform, operator);
        bytes32 subId = _subscribe(key);
        _approve(n * AMOUNT);

        for (uint256 i; i < n; ++i) {
            uint256 dueAt = START + i * period;
            if (i > 0) {
                vm.warp(dueAt - 1);
                vm.expectRevert(Subscriptions.NotDueYet.selector);
                vm.prank(operator);
                subs.charge(subId, AMOUNT);
            }
            vm.warp(dueAt);
            _charge(subId, AMOUNT);
            assertEq(_sub(subs, subId).nextChargeAt, dueAt + period);
            vm.expectRevert(Subscriptions.NotDueYet.selector);
            vm.prank(operator);
            subs.charge(subId, AMOUNT);
        }

        assertEq(usdc.balanceOf(platform), n * AMOUNT);
        assertEq(usdc.balanceOf(subscriber), INITIAL_BALANCE - n * AMOUNT);
        assertEq(usdc.allowance(subscriber, address(subs)), 0);
    }

    // -------------------------------------------------------------- helpers

    function _terms() internal view returns (Subscriptions.Terms memory) {
        return Subscriptions.Terms(usdc, AMOUNT, PERIOD);
    }

    function _approve(uint256 value) internal {
        vm.prank(subscriber);
        usdc.approve(address(subs), value);
    }

    function _subscribe(bytes32 key) internal returns (bytes32 subId) {
        vm.startPrank(subscriber);
        usdc.approve(address(subs), PERMIT_VALUE);
        subId = subs.subscribe(key);
        vm.stopPrank();
    }

    /// @dev Relays with the main plan's terms; makes no other call, so it can
    /// follow `vm.expectRevert`.
    function _relay(bytes32 key, address who, uint256 deadline, bytes memory sig) internal returns (bytes32) {
        vm.prank(relayer);
        return subs.subscribeWithAuthorization(key, who, _terms(), deadline, sig);
    }

    function _charge(bytes32 subId, uint256 amount) internal {
        vm.prank(operator);
        subs.charge(subId, amount);
    }
}

/// @dev Drives one subscription through random charges, pauses and resumes by
/// either party, cancels, subscribes on all three paths, destination changes
/// and time jumps. It keeps its own model of the subscription and counts every
/// call whose outcome or resulting state differs from it, and it counts the
/// billing periods in which the subscription was active at some moment.
contract SubscriptionsHandler is SubscriptionsSigning {
    Subscriptions internal subs;
    MockUSDC internal usdc;
    bytes32 internal planKey;
    bytes32 public subId;
    address internal owner;
    address internal puller;
    address internal subscriber;
    uint256 internal subscriberKey;
    uint256 internal amount;
    uint256 internal period;
    address[3] internal destinations;

    /// @dev The handler's clock: Foundry does not promise that a warp in one
    /// call is still in effect in the next.
    uint256 public currentTime;
    uint256 public totalCharged;
    uint256 public chargeCount;
    uint256 public strangerCharges;
    uint256 public mismatches;
    uint256 public activePeriods;

    Subscriptions.Status internal status;
    Subscriptions.PausedBy internal pausedBy;
    uint256 internal anchor;
    uint256 internal nextDue;
    uint256 internal nextUncountedPeriod;

    constructor(
        Subscriptions subs_,
        MockUSDC usdc_,
        bytes32 planKey_,
        address puller_,
        uint256 subscriberKey_,
        address[3] memory destinations_
    ) {
        subs = subs_;
        usdc = usdc_;
        planKey = planKey_;
        puller = puller_;
        subscriberKey = subscriberKey_;
        subscriber = vm.addr(subscriberKey_);
        destinations = destinations_;
        Subscriptions.Terms memory terms = _planTerms(subs_, planKey_);
        (owner,,,,,,) = subs_.plans(planKey_);
        amount = terms.amount;
        period = terms.periodSeconds;
        subId = keccak256(abi.encode(planKey_, subscriber));
        currentTime = block.timestamp;
    }

    function warp(uint256 seconds_) external {
        currentTime += _bound(seconds_, 0, 3 * period);
        _countActivePeriods();
    }

    function charge(uint256 value) external {
        vm.warp(currentTime);
        value = _bound(value, 0, 2 * amount);
        bool expected = status == Subscriptions.Status.Active && currentTime >= nextDue && value > 0 && value <= amount;
        vm.prank(puller);
        try subs.charge(subId, value) {
            totalCharged += value;
            chargeCount += 1;
            nextDue = anchor + ((currentTime - anchor) / period + 1) * period;
            _expect(expected);
        } catch {
            _expect(!expected);
        }
        _compareState();
    }

    function chargeAsStranger(address caller, uint256 value) external {
        vm.warp(currentTime);
        if (caller == puller) return;
        value = _bound(value, 1, amount);
        vm.prank(caller);
        try subs.charge(subId, value) {
            strangerCharges += 1;
        } catch {}
    }

    function pause(bool byOwner) external {
        vm.warp(currentTime);
        bool expected = status == Subscriptions.Status.Active;
        vm.prank(byOwner ? owner : subscriber);
        try subs.pause(subId) {
            status = Subscriptions.Status.Paused;
            pausedBy = byOwner ? Subscriptions.PausedBy.Owner : Subscriptions.PausedBy.Subscriber;
            _expect(expected);
        } catch {
            _expect(!expected);
        }
        _compareState();
    }

    function resume(bool byOwner) external {
        vm.warp(currentTime);
        bool expected =
            status == Subscriptions.Status.Paused && (byOwner || pausedBy == Subscriptions.PausedBy.Subscriber);
        vm.prank(byOwner ? owner : subscriber);
        try subs.resume(subId) {
            status = Subscriptions.Status.Active;
            pausedBy = Subscriptions.PausedBy.None;
            // Periods that passed entirely while paused were never active.
            uint256 current = (currentTime - anchor) / period;
            if (current > nextUncountedPeriod) nextUncountedPeriod = current;
            _countActivePeriods();
            _expect(expected);
        } catch {
            _expect(!expected);
        }
        _compareState();
    }

    function cancel(bool byOwner) external {
        vm.warp(currentTime);
        bool expected = status == Subscriptions.Status.Active || status == Subscriptions.Status.Paused;
        vm.prank(byOwner ? owner : subscriber);
        try subs.cancel(subId) {
            status = Subscriptions.Status.Canceled;
            pausedBy = Subscriptions.PausedBy.None;
            _expect(expected);
        } catch {
            _expect(!expected);
        }
        _compareState();
    }

    /// @param path 0: `subscribe`, 1: `subscribeWithAuthorization`, 2: `subscribeWithPermit`.
    function resubscribe(uint8 path) external {
        vm.warp(currentTime);
        bool expected = status == Subscriptions.Status.None || status == Subscriptions.Status.Canceled;
        if (_subscribeVia(path % 3)) {
            status = Subscriptions.Status.Active;
            pausedBy = Subscriptions.PausedBy.None;
            anchor = currentTime;
            nextDue = currentTime;
            nextUncountedPeriod = 0;
            _countActivePeriods();
            _expect(expected);
        } else {
            _expect(!expected);
        }
        _compareState();
    }

    function rotateDestination(uint8 index) external {
        vm.warp(currentTime);
        vm.prank(owner);
        subs.setPlanDestination(planKey, destinations[index % destinations.length]);
    }

    function _subscribeVia(uint8 path) internal returns (bool) {
        if (path == 0) {
            vm.prank(subscriber);
            try subs.subscribe(planKey) {
                return true;
            } catch {
                return false;
            }
        }
        uint256 deadline = currentTime + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, deadline);
        Subscriptions.Terms memory terms = _planTerms(subs, planKey);
        if (path == 1) {
            try subs.subscribeWithAuthorization(planKey, subscriber, terms, deadline, sig) {
                return true;
            } catch {
                return false;
            }
        }
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, subscriberKey, subscriber, address(subs), type(uint256).max, deadline);
        try subs.subscribeWithPermit(planKey, subscriber, terms, type(uint256).max, deadline, v, r, s, deadline, sig) {
            return true;
        } catch {
            return false;
        }
    }

    /// @dev Counts every billing period of the current schedule, up to now, in
    /// which the subscription has been active and that is not counted yet.
    function _countActivePeriods() internal {
        if (status != Subscriptions.Status.Active) return;
        uint256 current = (currentTime - anchor) / period;
        if (current < nextUncountedPeriod) return;
        activePeriods += current + 1 - nextUncountedPeriod;
        nextUncountedPeriod = current + 1;
    }

    function _compareState() internal {
        Subscriptions.Sub memory sub = _sub(subs, subId);
        if (sub.status != status || sub.pausedBy != pausedBy) mismatches += 1;
        if (status != Subscriptions.Status.None && sub.nextChargeAt != nextDue) mismatches += 1;
    }

    function _expect(bool asModelled) internal {
        if (!asModelled) mismatches += 1;
    }
}

contract SubscriptionsInvariantTest is Test {
    uint256 internal constant AMOUNT = 10e6;
    uint64 internal constant PERIOD = 1 days;

    MockUSDC internal usdc;
    Subscriptions internal subs;
    SubscriptionsHandler internal handler;
    address[3] internal destinations = [makeAddr("platform"), makeAddr("treasury"), makeAddr("reserve")];

    function setUp() public {
        vm.warp(1_767_225_600);
        usdc = new MockUSDC();
        subs = new Subscriptions();
        address operator = makeAddr("operator");
        address puller = makeAddr("puller");
        (address subscriber, uint256 subscriberKey) = makeAddrAndKey("subscriber");
        vm.prank(operator);
        bytes32 planKey = subs.createPlan(keccak256("invariant"), usdc, AMOUNT, PERIOD, destinations[0], puller);

        usdc.mint(subscriber, type(uint128).max);
        vm.prank(subscriber);
        usdc.approve(address(subs), type(uint256).max);

        handler = new SubscriptionsHandler(subs, usdc, planKey, puller, subscriberKey, destinations);
        handler.resubscribe(0);
        targetContract(address(handler));
    }

    /// @notice Over N billing periods in which the subscription was active, the
    /// puller never charges more than N times, nor takes more than N times the
    /// plan amount.
    function invariant_chargesWithinPeriodsElapsedWhileActive() public view {
        uint256 periods = handler.activePeriods();
        assertLe(handler.chargeCount(), periods);
        assertLe(handler.totalCharged(), periods * AMOUNT);
    }

    /// @notice Every charge, pause, resume, cancel and subscribe succeeds or
    /// fails exactly as the model says, and leaves the state it predicts.
    function invariant_contractMatchesTheModel() public view {
        assertEq(handler.mismatches(), 0);
    }

    function invariant_destinationsReceivedExactlyWhatWasCharged() public view {
        uint256 received;
        for (uint256 i; i < destinations.length; ++i) {
            received += usdc.balanceOf(destinations[i]);
        }
        assertEq(received, handler.totalCharged());
        assertEq(usdc.balanceOf(address(subs)), 0);
    }

    function invariant_onlyThePullerCharges() public view {
        assertEq(handler.strangerCharges(), 0);
    }
}
