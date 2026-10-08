// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
/// Auditable immutable window roots; the writer cannot replace a prior commitment.
contract PulseCommitment {
    address public immutable writer;
    struct Commitment { bytes32 root; uint256 count; uint64 committedAt; }
    mapping(bytes32 => Commitment) public commitments;
    event PulseWindowCommitted(bytes32 indexed windowHash, bytes32 acceptanceRoot, uint256 receiptCount, uint64 committedAt);
    constructor(address authorizedWriter) { require(block.chainid == 4663 && authorizedWriter != address(0), "invalid writer"); writer = authorizedWriter; }
    function commitPulseWindow(bytes32 windowHash, bytes32 root, uint256 count, uint64 committedAt) external {
        require(msg.sender == writer && commitments[windowHash].root == bytes32(0), "immutable commitment");
        require(root != bytes32(0) && count > 0 && committedAt <= block.timestamp, "invalid commitment");
        commitments[windowHash] = Commitment(root, count, committedAt);
        emit PulseWindowCommitted(windowHash, root, count, committedAt);
    }
}
