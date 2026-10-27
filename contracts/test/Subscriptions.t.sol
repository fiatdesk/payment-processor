// SPDX-License-Identifier: Apache-2.0
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Subscriptions} from "../src/Subscriptions.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @dev Signing helpers shared by the unit and invariant suites. The EIP-712
/// domain is rebuilt here from its parts rather than read from the contract,
/// so the tests pin the domain an off-chain signer has to use.
abstract contract SubscriptionsSigning is Test {
    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant SUBSCRIBE_TYPEHASH =
        keccak256("Subscribe(bytes32 planKey,address subscriber,uint256 nonce,uint256 deadline)");
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function _signSubscribe(
        Subscriptions subs,
        uint256 signerKey,
        bytes32 planKey,
        address subscriber,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 domain = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("Subscriptions"), keccak256("1"), block.chainid, address(subs))
        );
        bytes32 structHash = keccak256(abi.encode(SUBSCRIBE_TYPEHASH, planKey, subscriber, nonce, deadline));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, MessageHashUtils.toTypedDataHash(domain, structHash));
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
}

contract SubscriptionsTest is SubscriptionsSigning {
    bytes32 internal constant PLAN_ID = keccak256("price_z_monthly");
    uint256 internal constant AMOUNT = 25e6;
    uint64 internal constant PERIOD = 30 days;
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

        bytes memory sig = _signSubscribe(subs, otherKey, planKey, other, 0, block.timestamp + 1 hours);
        vm.expectRevert(Subscriptions.PlanInactive.selector);
        vm.prank(relayer);
        subs.subscribeWithAuthorization(planKey, other, block.timestamp + 1 hours, sig);

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
        usdc.approve(address(subs), type(uint256).max);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Subscribed(expectedId, planKey, subscriber, START);
        vm.prank(subscriber);
        bytes32 subId = subs.subscribe(planKey);

        assertEq(subId, expectedId);
        (bytes32 key, address who, uint64 nextChargeAt, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(key, planKey);
        assertEq(who, subscriber);
        assertEq(nextChargeAt, START);
        assertEq(uint8(status), uint8(Subscriptions.Status.Active));
        // Subscribing moves no money and uses no Subscribe nonce.
        assertEq(usdc.balanceOf(subscriber), INITIAL_BALANCE);
        assertEq(subs.nonces(subscriber), 0);
    }

    function testUnknownSubscriptionIsNone() public view {
        (bytes32 key, address who, uint64 nextChargeAt, Subscriptions.Status status) =
            subs.subscriptions(keccak256(abi.encode(planKey, subscriber)));
        assertEq(key, bytes32(0));
        assertEq(who, address(0));
        assertEq(nextChargeAt, 0);
        assertEq(uint8(status), uint8(Subscriptions.Status.None));
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
        (,, uint64 nextChargeAt, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(nextChargeAt, START + 3 days);
        assertEq(uint8(status), uint8(Subscriptions.Status.Active));
        _charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(platform), 2 * AMOUNT);
    }

    // ------------------------------------------- subscribeWithAuthorization

    function testSubscribeWithAuthorizationRelayedByThirdParty() public {
        vm.prank(subscriber);
        usdc.approve(address(subs), type(uint256).max);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, 0, deadline);
        uint256 relayerBalance = usdc.balanceOf(relayer);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Subscribed(keccak256(abi.encode(planKey, subscriber)), planKey, subscriber, START);
        vm.prank(relayer);
        bytes32 subId = subs.subscribeWithAuthorization(planKey, subscriber, deadline, sig);

        (, address who,, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(who, subscriber);
        assertEq(uint8(status), uint8(Subscriptions.Status.Active));
        assertEq(subs.nonces(subscriber), 1);
        assertEq(usdc.balanceOf(relayer), relayerBalance);
    }

    function testSubscribeTypehashAndDomain() public view {
        assertEq(subs.SUBSCRIBE_TYPEHASH(), SUBSCRIBE_TYPEHASH);
        (, string memory name, string memory version, uint256 chainId, address verifyingContract,,) =
            subs.eip712Domain();
        assertEq(name, "Subscriptions");
        assertEq(version, "1");
        assertEq(chainId, block.chainid);
        assertEq(verifyingContract, address(subs));
    }

    function testSubscribeWithAuthorizationAfterDeadlineReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, 0, deadline);

        vm.warp(deadline + 1);
        vm.expectRevert(Subscriptions.ExpiredSignature.selector);
        vm.prank(relayer);
        subs.subscribeWithAuthorization(planKey, subscriber, deadline, sig);
    }

    function testSubscribeWithAuthorizationAtDeadlineSucceeds() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, 0, deadline);

        vm.warp(deadline);
        vm.prank(relayer);
        bytes32 subId = subs.subscribeWithAuthorization(planKey, subscriber, deadline, sig);

        (,,, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(uint8(status), uint8(Subscriptions.Status.Active));
    }

    function testSubscribeWithAuthorizationRejectsAnotherSigner() public {
        (, uint256 strangerKey) = makeAddrAndKey("signing-stranger");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, strangerKey, planKey, subscriber, 0, deadline);

        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        vm.prank(relayer);
        subs.subscribeWithAuthorization(planKey, subscriber, deadline, sig);
    }

    function testSubscribeWithAuthorizationRejectsMalformedSignature() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        vm.prank(relayer);
        subs.subscribeWithAuthorization(planKey, subscriber, deadline, hex"1234");
    }

    function testSubscribeWithAuthorizationIsBoundToItsPlanAndDeadline() public {
        vm.prank(operator);
        bytes32 otherPlan = subs.createPlan(keccak256("other"), usdc, AMOUNT, PERIOD, platform, operator);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, 0, deadline);

        vm.startPrank(relayer);
        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        subs.subscribeWithAuthorization(otherPlan, subscriber, deadline, sig);
        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        subs.subscribeWithAuthorization(planKey, subscriber, deadline + 1, sig);
        vm.stopPrank();
    }

    function testSubscribeWithAuthorizationCannotBeReplayedAfterCancel() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, 0, deadline);
        vm.prank(relayer);
        bytes32 subId = subs.subscribeWithAuthorization(planKey, subscriber, deadline, sig);
        vm.prank(subscriber);
        subs.cancel(subId);

        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        vm.prank(relayer);
        subs.subscribeWithAuthorization(planKey, subscriber, deadline, sig);

        (,,, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(uint8(status), uint8(Subscriptions.Status.Canceled));
    }

    // -------------------------------------------------- subscribeWithPermit

    function testSubscribeWithPermitRelayedByThirdParty() public {
        assertEq(usdc.allowance(subscriber, address(subs)), 0);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, subscriberKey, subscriber, address(subs), type(uint256).max, deadline);
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, 0, deadline);

        vm.prank(relayer);
        bytes32 subId =
            subs.subscribeWithPermit(planKey, subscriber, type(uint256).max, deadline, v, r, s, deadline, sig);

        assertEq(usdc.allowance(subscriber, address(subs)), type(uint256).max);
        assertEq(usdc.nonces(subscriber), 1);
        assertEq(subs.nonces(subscriber), 1);
        (, address who,, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(who, subscriber);
        assertEq(uint8(status), uint8(Subscriptions.Status.Active));

        // The first period is due at once.
        _charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(platform), AMOUNT);
        assertEq(usdc.balanceOf(subscriber), INITIAL_BALANCE - AMOUNT);
    }

    function testSubscribeWithPermitSurvivesAFrontRunPermit() public {
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, subscriberKey, subscriber, address(subs), type(uint256).max, deadline);
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, 0, deadline);

        // Someone copies the permit out of the mempool and submits it first.
        vm.prank(stranger);
        usdc.permit(subscriber, address(subs), type(uint256).max, deadline, v, r, s);

        vm.prank(relayer);
        bytes32 subId =
            subs.subscribeWithPermit(planKey, subscriber, type(uint256).max, deadline, v, r, s, deadline, sig);

        (,,, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(uint8(status), uint8(Subscriptions.Status.Active));
        assertEq(usdc.allowance(subscriber, address(subs)), type(uint256).max);
    }

    function testSubscribeWithPermitRevertsOnABadPermitWithoutAllowance() public {
        (, uint256 strangerKey) = makeAddrAndKey("signing-stranger");
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, strangerKey, subscriber, address(subs), type(uint256).max, deadline);
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, 0, deadline);

        vm.expectRevert(bytes("EIP2612: invalid signature"));
        vm.prank(relayer);
        subs.subscribeWithPermit(planKey, subscriber, type(uint256).max, deadline, v, r, s, deadline, sig);

        assertEq(subs.nonces(subscriber), 0);
        (,,, Subscriptions.Status status) = subs.subscriptions(keccak256(abi.encode(planKey, subscriber)));
        assertEq(uint8(status), uint8(Subscriptions.Status.None));
    }

    function testSubscribeWithPermitRollsBackThePermitOnABadSubscribeSignature() public {
        (, uint256 strangerKey) = makeAddrAndKey("signing-stranger");
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, subscriberKey, subscriber, address(subs), type(uint256).max, deadline);
        bytes memory sig = _signSubscribe(subs, strangerKey, planKey, subscriber, 0, deadline);

        vm.expectRevert(Subscriptions.InvalidSignature.selector);
        vm.prank(relayer);
        subs.subscribeWithPermit(planKey, subscriber, type(uint256).max, deadline, v, r, s, deadline, sig);

        assertEq(usdc.allowance(subscriber, address(subs)), 0);
        assertEq(usdc.nonces(subscriber), 0);
    }

    function testSubscribeWithPermitToInactivePlanReverts() public {
        vm.prank(operator);
        subs.deactivatePlan(planKey);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) =
            _signPermit(usdc, subscriberKey, subscriber, address(subs), type(uint256).max, deadline);
        bytes memory sig = _signSubscribe(subs, subscriberKey, planKey, subscriber, 0, deadline);

        vm.expectRevert(Subscriptions.PlanInactive.selector);
        vm.prank(relayer);
        subs.subscribeWithPermit(planKey, subscriber, type(uint256).max, deadline, v, r, s, deadline, sig);
        assertEq(usdc.allowance(subscriber, address(subs)), 0);
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
        (,, uint64 nextChargeAt,) = subs.subscriptions(subId);
        assertEq(nextChargeAt, START + PERIOD);
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

    function testChargeAfterThePeriodElapsesAdvancesByExactlyOnePeriod() public {
        bytes32 subId = _subscribe(planKey);
        _charge(subId, AMOUNT);

        // Charged late: the schedule still moves from the due time, not from now.
        vm.warp(START + PERIOD + 5 hours);
        _charge(subId, AMOUNT);

        (,, uint64 nextChargeAt,) = subs.subscriptions(subId);
        assertEq(nextChargeAt, START + 2 * uint256(PERIOD));
        assertEq(usdc.balanceOf(platform), 2 * AMOUNT);
    }

    function testMissedPeriodsCanBeCollectedOnePerElapsedPeriod() public {
        bytes32 subId = _subscribe(planKey);

        // Three full periods pass without a charge: four periods have started.
        vm.warp(START + 3 * uint256(PERIOD));
        for (uint256 i; i < 4; ++i) {
            _charge(subId, AMOUNT);
        }
        vm.expectRevert(Subscriptions.NotDueYet.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);

        assertEq(usdc.balanceOf(platform), 4 * AMOUNT);
        (,, uint64 nextChargeAt,) = subs.subscriptions(subId);
        assertEq(nextChargeAt, START + 4 * uint256(PERIOD));
    }

    function testChargeAboveThePlanAmountReverts() public {
        bytes32 subId = _subscribe(planKey);

        vm.expectRevert(Subscriptions.AmountExceedsPlan.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT + 1);

        (,, uint64 nextChargeAt,) = subs.subscriptions(subId);
        assertEq(nextChargeAt, START);
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
        vm.prank(subscriber);
        usdc.approve(address(subs), 0);

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(subs), 0, AMOUNT)
        );
        vm.prank(operator);
        subs.charge(subId, AMOUNT);

        (,, uint64 nextChargeAt, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(nextChargeAt, START);
        assertEq(uint8(status), uint8(Subscriptions.Status.Active));
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
        (,, uint64 nextChargeAt,) = subs.subscriptions(subId);
        assertEq(nextChargeAt, START + PERIOD);
    }

    // --------------------------------------------------------------- cancel

    function testCancelBySubscriber() public {
        bytes32 subId = _subscribe(planKey);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Canceled(subId, subscriber);
        vm.prank(subscriber);
        subs.cancel(subId);

        (,,, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(uint8(status), uint8(Subscriptions.Status.Canceled));
        vm.expectRevert(Subscriptions.NotActive.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);
    }

    function testCancelByPlanOwner() public {
        bytes32 subId = _subscribe(planKey);

        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Canceled(subId, operator);
        vm.prank(operator);
        subs.cancel(subId);

        (,,, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(uint8(status), uint8(Subscriptions.Status.Canceled));
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

        (,,, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(uint8(status), uint8(Subscriptions.Status.Active));
    }

    function testCancelPausedSubscription() public {
        bytes32 subId = _subscribe(planKey);
        vm.startPrank(subscriber);
        subs.pause(subId);
        subs.cancel(subId);
        vm.stopPrank();

        (,,, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(uint8(status), uint8(Subscriptions.Status.Canceled));
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

        vm.expectRevert(Subscriptions.NotActive.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(platform), 0);
    }

    function testResumeSetsNextChargeOnePeriodFromNow() public {
        bytes32 subId = _subscribe(planKey);
        _charge(subId, AMOUNT);
        vm.prank(subscriber);
        subs.pause(subId);

        // No back-charging for the paused months.
        uint64 resumedAt = START + 5 * PERIOD + 123;
        vm.warp(resumedAt);
        vm.expectEmit(true, true, true, true, address(subs));
        emit Subscriptions.Resumed(subId, subscriber, resumedAt + PERIOD);
        vm.prank(subscriber);
        subs.resume(subId);

        (,, uint64 nextChargeAt, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(nextChargeAt, resumedAt + PERIOD);
        assertEq(uint8(status), uint8(Subscriptions.Status.Active));
        vm.expectRevert(Subscriptions.NotDueYet.selector);
        vm.prank(operator);
        subs.charge(subId, AMOUNT);

        vm.warp(resumedAt + PERIOD);
        _charge(subId, AMOUNT);
        assertEq(usdc.balanceOf(platform), 2 * AMOUNT);
    }

    function testPlanOwnerCanPauseAndResume() public {
        bytes32 subId = _subscribe(planKey);

        vm.startPrank(operator);
        subs.pause(subId);
        subs.resume(subId);
        vm.stopPrank();

        (,, uint64 nextChargeAt, Subscriptions.Status status) = subs.subscriptions(subId);
        assertEq(nextChargeAt, START + PERIOD);
        assertEq(uint8(status), uint8(Subscriptions.Status.Active));
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

        // Resuming an active subscription would push its next charge out.
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
            (,, uint64 nextChargeAt,) = subs.subscriptions(subId);
            assertEq(nextChargeAt, dueAt + period);
            vm.expectRevert(Subscriptions.NotDueYet.selector);
            vm.prank(operator);
            subs.charge(subId, AMOUNT);
        }

        assertEq(usdc.balanceOf(platform), n * AMOUNT);
        assertEq(usdc.balanceOf(subscriber), INITIAL_BALANCE - n * AMOUNT);
    }

    // -------------------------------------------------------------- helpers

    function _subscribe(bytes32 key) internal returns (bytes32 subId) {
        vm.startPrank(subscriber);
        usdc.approve(address(subs), type(uint256).max);
        subId = subs.subscribe(key);
        vm.stopPrank();
    }

    function _charge(bytes32 subId, uint256 amount) internal {
        vm.prank(operator);
        subs.charge(subId, amount);
    }
}

/// @dev Drives one subscription through random charges, pauses, resumes,
/// cancels, re-subscribes and time jumps. It tracks how many billing periods
/// have started while the subscription was active (each subscribe starts one
/// at once, each resume one a period later), independently of the contract.
contract SubscriptionsHandler is Test {
    Subscriptions internal subs;
    MockUSDC internal usdc;
    bytes32 internal planKey;
    bytes32 public subId;
    address internal owner;
    address internal puller;
    address internal subscriber;
    uint256 internal amount;
    uint256 internal period;

    /// @dev The handler's clock: Foundry does not promise that a warp in one
    /// call is still in effect in the next.
    uint256 public currentTime;
    uint256 public totalCharged;
    uint256 public chargeCount;
    uint256 public strangerCharges;
    uint256 internal closedCycles;
    bool internal segmentOpen;
    uint256 internal segmentFirstDue;

    constructor(
        Subscriptions subs_,
        MockUSDC usdc_,
        bytes32 planKey_,
        address owner_,
        address puller_,
        address subscriber_
    ) {
        subs = subs_;
        usdc = usdc_;
        planKey = planKey_;
        owner = owner_;
        puller = puller_;
        subscriber = subscriber_;
        (,,,, uint256 planAmount, uint64 planPeriod,) = subs_.plans(planKey_);
        amount = planAmount;
        period = planPeriod;
        subId = keccak256(abi.encode(planKey_, subscriber_));
        currentTime = block.timestamp;
    }

    function warp(uint256 seconds_) external {
        currentTime += _bound(seconds_, 0, 3 * period);
        vm.warp(currentTime);
    }

    function charge(uint256 value) external {
        vm.warp(currentTime);
        value = _bound(value, 0, 2 * amount);
        vm.prank(puller);
        try subs.charge(subId, value) {
            totalCharged += value;
            chargeCount += 1;
        } catch {}
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
        vm.prank(byOwner ? owner : subscriber);
        try subs.pause(subId) {
            _closeSegment();
        } catch {}
    }

    function resume(bool byOwner) external {
        vm.warp(currentTime);
        vm.prank(byOwner ? owner : subscriber);
        try subs.resume(subId) {
            segmentOpen = true;
            segmentFirstDue = currentTime + period;
        } catch {}
    }

    function cancel(bool byOwner) external {
        vm.warp(currentTime);
        vm.prank(byOwner ? owner : subscriber);
        try subs.cancel(subId) {
            if (segmentOpen) _closeSegment();
        } catch {}
    }

    function resubscribe() external {
        vm.warp(currentTime);
        vm.prank(subscriber);
        try subs.subscribe(planKey) {
            segmentOpen = true;
            segmentFirstDue = currentTime;
        } catch {}
    }

    /// @notice Billing periods that started while the subscription was active.
    function elapsedCycles() public view returns (uint256) {
        return closedCycles + (segmentOpen ? _cyclesUntil(currentTime) : 0);
    }

    function _closeSegment() internal {
        closedCycles += _cyclesUntil(currentTime);
        segmentOpen = false;
    }

    function _cyclesUntil(uint256 time) internal view returns (uint256) {
        if (time < segmentFirstDue) return 0;
        return (time - segmentFirstDue) / period + 1;
    }
}

contract SubscriptionsInvariantTest is Test {
    uint256 internal constant AMOUNT = 10e6;
    uint64 internal constant PERIOD = 1 days;

    MockUSDC internal usdc;
    Subscriptions internal subs;
    SubscriptionsHandler internal handler;
    address internal platform = makeAddr("platform");

    function setUp() public {
        vm.warp(1_767_225_600);
        usdc = new MockUSDC();
        subs = new Subscriptions();
        address operator = makeAddr("operator");
        address puller = makeAddr("puller");
        address subscriber = makeAddr("subscriber");
        vm.prank(operator);
        bytes32 planKey = subs.createPlan(keccak256("invariant"), usdc, AMOUNT, PERIOD, platform, puller);

        usdc.mint(subscriber, type(uint128).max);
        vm.prank(subscriber);
        usdc.approve(address(subs), type(uint256).max);

        handler = new SubscriptionsHandler(subs, usdc, planKey, operator, puller, subscriber);
        handler.resubscribe();
        targetContract(address(handler));
    }

    /// @notice Over N started billing periods the puller never takes more
    /// than N times the plan amount, nor charges more than N times.
    function invariant_totalChargedWithinElapsedCyclesTimesAmount() public view {
        uint256 cycles = handler.elapsedCycles();
        assertLe(handler.totalCharged(), cycles * AMOUNT);
        assertLe(handler.chargeCount(), cycles);
    }

    function invariant_destinationReceivedExactlyWhatWasCharged() public view {
        assertEq(usdc.balanceOf(platform), handler.totalCharged());
        assertEq(usdc.balanceOf(address(subs)), 0);
    }

    function invariant_onlyThePullerCharges() public view {
        assertEq(handler.strangerCharges(), 0);
    }
}
