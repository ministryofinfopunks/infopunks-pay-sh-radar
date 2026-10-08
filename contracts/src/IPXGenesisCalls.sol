// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// One-time cohort seal, fully funded from fixed supply. Entitlement is IPX, never PLTR shares or yield.
contract IPXGenesisCalls {
    using SafeERC20 for IERC20;
    uint256 public constant LIMIT = 4663;
    IERC20 public immutable token;
    address public immutable sealer;
    uint256 public immutable allocation;
    bytes32 public cohortRoot;
    mapping(uint256 => bool) public claimedOrdinal;
    mapping(address => bool) public claimedWallet;
    event CohortSealed(bytes32 root, uint256 count, uint256 allocation);
    event EntitlementClaimed(uint256 indexed ordinal, address indexed wallet, bytes32 callHash, uint256 amount);
    constructor(IERC20 ipx, address cohortSealer, uint256 genesisAllocation) {
        require(block.chainid == 4663 && address(ipx).code.length > 0 && cohortSealer != address(0) && genesisAllocation >= LIMIT, "invalid cohort");
        token = ipx; sealer = cohortSealer; allocation = genesisAllocation;
    }
    function seal(bytes32 root, uint256 count) external {
        require(msg.sender == sealer && cohortRoot == bytes32(0), "seal authority");
        require(root != bytes32(0) && count == LIMIT && token.balanceOf(address(this)) >= allocation, "incomplete cohort");
        cohortRoot = root; emit CohortSealed(root, count, allocation);
    }
    function entitlement(uint256 ordinal) public view returns (uint256) {
        require(ordinal > 0 && ordinal <= LIMIT, "invalid ordinal");
        return allocation / LIMIT + (ordinal == LIMIT ? allocation % LIMIT : 0);
    }
    function claim(uint256 ordinal, bytes32 callHash, bytes32[] calldata proof) external {
        require(cohortRoot != bytes32(0) && !claimedOrdinal[ordinal] && !claimedWallet[msg.sender], "already claimed or unsealed");
        require(proof.length <= 32, "proof too long");
        uint256 amount = entitlement(ordinal);
        bytes32 leaf = sha256(abi.encodePacked("ipx.genesis.entitlement.v2", block.chainid, address(this), ordinal, msg.sender, amount, callHash));
        for (uint256 i; i < proof.length; ++i) leaf = leaf < proof[i] ? sha256(abi.encodePacked(leaf, proof[i])) : sha256(abi.encodePacked(proof[i], leaf));
        require(leaf == cohortRoot, "invalid proof");
        claimedOrdinal[ordinal] = true; claimedWallet[msg.sender] = true;
        token.safeTransfer(msg.sender, amount);
        emit EntitlementClaimed(ordinal, msg.sender, callHash, amount);
    }
}
