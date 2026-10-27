// SPDX-License-Identifier: Apache-2.0
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Subscriptions} from "../src/Subscriptions.sol";

/// @notice Deploys Subscriptions with the signer given on the command line
/// (`--account`, `--ledger` or `--private-key`). See contracts/README.md.
contract DeploySubscriptions is Script {
    function run() external returns (Subscriptions subscriptions) {
        vm.startBroadcast();
        subscriptions = new Subscriptions();
        vm.stopBroadcast();
        console2.log("Subscriptions deployed at", address(subscriptions));
    }
}
