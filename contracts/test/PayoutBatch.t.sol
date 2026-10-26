// SPDX-License-Identifier: Apache-2.0
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {PayoutBatch} from "../src/PayoutBatch.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract PayoutBatchTest is Test {
    event BatchPaid(
        address indexed payer, address indexed token, bytes32 indexed batchId, uint256 count, uint256 total
    );

    bytes32 internal constant BATCH_ID = keccak256("po_1,po_2,po_3");

    MockUSDC internal usdc;
    PayoutBatch internal batch;
    address internal payer = makeAddr("payer");

    function setUp() public {
        usdc = new MockUSDC();
        batch = new PayoutBatch();
        usdc.mint(payer, 1_000_000e6);
        vm.prank(payer);
        usdc.approve(address(batch), type(uint256).max);
    }

    function testDisperseTransfersEachAmount() public {
        address[] memory recipients = new address[](3);
        recipients[0] = makeAddr("seller1");
        recipients[1] = makeAddr("seller2");
        recipients[2] = makeAddr("seller3");
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 10e6;
        amounts[1] = 25_500_000;
        amounts[2] = 1;

        vm.expectEmit(true, true, true, true, address(batch));
        emit BatchPaid(payer, address(usdc), BATCH_ID, 3, 35_500_001);
        vm.prank(payer);
        batch.disperse(usdc, recipients, amounts, BATCH_ID);

        assertEq(usdc.balanceOf(recipients[0]), 10e6);
        assertEq(usdc.balanceOf(recipients[1]), 25_500_000);
        assertEq(usdc.balanceOf(recipients[2]), 1);
        assertEq(usdc.balanceOf(payer), 1_000_000e6 - 35_500_001);
        assertEq(usdc.balanceOf(address(batch)), 0);
    }

    function testRevertsOnLengthMismatch() public {
        address[] memory recipients = new address[](2);
        recipients[0] = makeAddr("seller1");
        recipients[1] = makeAddr("seller2");
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1e6;

        vm.expectRevert(PayoutBatch.LengthMismatch.selector);
        vm.prank(payer);
        batch.disperse(usdc, recipients, amounts, BATCH_ID);
    }

    function testRevertsOnEmpty() public {
        vm.expectRevert(PayoutBatch.EmptyBatch.selector);
        vm.prank(payer);
        batch.disperse(usdc, new address[](0), new uint256[](0), BATCH_ID);
    }

    function testRevertsOnTooMany() public {
        uint256 count = batch.MAX_RECIPIENTS() + 1;
        assertEq(count, 201);
        (address[] memory recipients, uint256[] memory amounts) = _uniformBatch(count, 1e6);

        vm.expectRevert(PayoutBatch.TooMany.selector);
        vm.prank(payer);
        batch.disperse(usdc, recipients, amounts, BATCH_ID);
    }

    function testRevertsOnZeroRecipient() public {
        (address[] memory recipients, uint256[] memory amounts) = _uniformBatch(3, 1e6);
        recipients[1] = address(0);

        vm.expectRevert(PayoutBatch.ZeroRecipient.selector);
        vm.prank(payer);
        batch.disperse(usdc, recipients, amounts, BATCH_ID);
    }

    function testRevertsOnZeroAmount() public {
        (address[] memory recipients, uint256[] memory amounts) = _uniformBatch(3, 1e6);
        amounts[2] = 0;

        vm.expectRevert(PayoutBatch.ZeroAmount.selector);
        vm.prank(payer);
        batch.disperse(usdc, recipients, amounts, BATCH_ID);

        assertEq(usdc.balanceOf(recipients[0]), 0);
        assertEq(usdc.balanceOf(payer), 1_000_000e6);
    }

    function testRevertsWhenAllowanceInsufficient() public {
        vm.prank(payer);
        usdc.approve(address(batch), 15e6);
        (address[] memory recipients, uint256[] memory amounts) = _uniformBatch(2, 10e6);

        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(batch), 5e6, 10e6)
        );
        vm.prank(payer);
        batch.disperse(usdc, recipients, amounts, BATCH_ID);
    }

    function testRevertsWhenRecipientBlacklisted() public {
        (address[] memory recipients, uint256[] memory amounts) = _uniformBatch(3, 1e6);
        usdc.blacklist(recipients[1], true);

        vm.expectRevert(bytes("Blacklistable: account is blacklisted"));
        vm.prank(payer);
        batch.disperse(usdc, recipients, amounts, BATCH_ID);

        assertEq(usdc.balanceOf(recipients[0]), 0);
        assertEq(usdc.balanceOf(payer), 1_000_000e6);
    }

    function testFuzzDisperse(uint8 count, uint96 seed) public {
        uint256 n = bound(count, 1, batch.MAX_RECIPIENTS());
        address[] memory recipients = new address[](n);
        uint256[] memory amounts = new uint256[](n);
        uint256 total;
        for (uint256 i; i < n; ++i) {
            recipients[i] = address(uint160(uint256(keccak256(abi.encode(seed, i, "recipient")))));
            amounts[i] = bound(uint256(keccak256(abi.encode(seed, i, "amount"))), 1, type(uint64).max);
            total += amounts[i];
        }
        address funder = makeAddr("funder");
        usdc.mint(funder, total);
        vm.prank(funder);
        usdc.approve(address(batch), total);

        vm.prank(funder);
        batch.disperse(usdc, recipients, amounts, bytes32(uint256(seed)));

        uint256 received;
        for (uint256 i; i < n; ++i) {
            received += usdc.balanceOf(recipients[i]);
        }
        assertEq(received, total);
        assertEq(usdc.balanceOf(funder), 0);
        assertEq(usdc.allowance(funder, address(batch)), 0);
    }

    function _uniformBatch(uint256 count, uint256 amount)
        internal
        returns (address[] memory recipients, uint256[] memory amounts)
    {
        recipients = new address[](count);
        amounts = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            recipients[i] = makeAddr(string.concat("seller", vm.toString(i)));
            amounts[i] = amount;
        }
    }
}
