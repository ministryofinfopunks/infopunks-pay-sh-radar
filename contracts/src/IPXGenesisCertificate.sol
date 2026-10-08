// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IPX} from "./IPX.sol";
import {IPXGenesisCalls} from "./IPXGenesisCalls.sol";

/// Immutable completion certificate. Token birth precedes cohort completion; both timestamps are retained.
contract IPXGenesisCertificate {
    uint256 public constant CHAIN_ID = 4663;
    IPX public immutable token;
    IPXGenesisCalls public immutable distributor;
    bytes32 public immutable constitutionSha256;
    bytes32 public immutable allocationHash;
    bytes32 public immutable cohortRoot;
    uint256 public constant COHORT_CALLS = 4663;
    uint256 public constant COHORT_WALLETS = 4663;
    uint256 public immutable genesisBlock;
    uint256 public immutable genesisTimestamp;
    uint256 public immutable certificateBlock;
    uint256 public immutable certificateTimestamp;
    event GenesisCertified(address indexed token, address indexed distributor, bytes32 cohortRoot, bytes32 constitutionSha256);
    constructor(IPX ipx, IPXGenesisCalls calls) {
        require(block.chainid == CHAIN_ID && address(ipx).code.length > 0 && address(calls).code.length > 0, "invalid certificate");
        require(address(calls.token()) == address(ipx) && calls.cohortRoot() != bytes32(0), "unsealed cohort");
        require(ipx.allocationRecipient(1) == address(calls) && ipx.allocationAmount(1) == calls.allocation(), "allocation mismatch");
        token = ipx; distributor = calls;
        constitutionSha256 = ipx.constitutionSha256(); allocationHash = ipx.allocationHash(); cohortRoot = calls.cohortRoot();
        genesisBlock = ipx.genesisBlock(); genesisTimestamp = ipx.genesisTimestamp();
        certificateBlock = block.number; certificateTimestamp = block.timestamp;
        emit GenesisCertified(address(ipx), address(calls), cohortRoot, constitutionSha256);
    }
}
