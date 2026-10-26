// SPDX-License-Identifier: Apache-2.0
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {PayoutBatch} from "../src/PayoutBatch.sol";

/// @notice Deploys PayoutBatch with the signer given on the command line
/// (`--account`, `--ledger` or `--private-key`). See contracts/README.md.
contract DeployPayoutBatch is Script {
    function run() external returns (PayoutBatch batch) {
        vm.startBroadcast();
        batch = new PayoutBatch();
        vm.stopBroadcast();
        console2.log("PayoutBatch deployed at", address(batch));
    }
}
