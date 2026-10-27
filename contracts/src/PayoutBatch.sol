// SPDX-License-Identifier: Apache-2.0
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PayoutBatch
/// @notice Pays many recipients from the caller's own token balance in one
/// all-or-nothing transaction. The caller approves this contract once. Each
/// payer can pay a given batch id only once, so a retried or re-signed batch
/// can never pay twice, and a batch past its deadline can never pay at all.
/// @dev No admin and non-upgradeable; it never holds tokens or ETH. Its only
/// state is the per-payer record of paid batch ids. It only moves
/// `msg.sender`'s tokens, so a standing allowance to it can be exercised by the
/// approving wallet alone.
contract PayoutBatch {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_RECIPIENTS = 200;

    /// @notice Whether `payer` has paid the batch with id `batchId`.
    mapping(address payer => mapping(bytes32 batchId => bool)) public paid;

    error EmptyBatch();
    error LengthMismatch();
    error TooMany();
    error ZeroRecipient();
    error ZeroAmount();
    error BatchAlreadyPaid();
    error ZeroBatchId();
    error BatchExpired();

    /// @param batchId Off-chain id that ties this transaction to its payouts.
    event BatchPaid(
        address indexed payer, address indexed token, bytes32 indexed batchId, uint256 count, uint256 total
    );

    /// @notice Transfers `amounts[i]` of `token` from the caller to `recipients[i]`
    /// and records `batchId` as paid by the caller.
    /// @param deadline Last block timestamp (inclusive) at which the batch may pay.
    function disperse(
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32 batchId,
        uint256 deadline
    ) external {
        if (block.timestamp > deadline) revert BatchExpired();
        uint256 count = recipients.length;
        if (count != amounts.length) revert LengthMismatch();
        if (count == 0) revert EmptyBatch();
        if (count > MAX_RECIPIENTS) revert TooMany();
        if (batchId == bytes32(0)) revert ZeroBatchId();
        if (paid[msg.sender][batchId]) revert BatchAlreadyPaid();
        // A revert in the loop below rolls this back with the transfers.
        paid[msg.sender][batchId] = true;

        uint256 total;
        for (uint256 i; i < count; ++i) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];
            if (recipient == address(0)) revert ZeroRecipient();
            if (amount == 0) revert ZeroAmount();
            total += amount;
            token.safeTransferFrom(msg.sender, recipient, amount);
        }

        emit BatchPaid(msg.sender, address(token), batchId, count, total);
    }
}
