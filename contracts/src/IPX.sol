// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// Fixed supply. No owner, proxy, mint entrypoint, transfer tax or blacklist.
contract IPX is ERC20, ERC20Burnable {
    enum Bucket { GenesisWallets, GenesisCalls, Treasury, Liquidity, Ecosystem, Burned }
    bytes32 public immutable constitutionSha256;
    bytes32 public immutable allocationHash;
    uint256 public immutable genesisBlock;
    uint256 public immutable genesisTimestamp;
    uint256 public immutable initialSupply;
    uint256[6] public allocationAmount;
    address[6] public allocationRecipient;
    event GenesisCertificate(uint256 chainId, address token, uint256 blockNumber, uint256 timestamp, bytes32 constitutionSha256, bytes32 allocationHash, uint256 initialSupply);
    constructor(bytes32 constitution, uint256 supply, address[6] memory recipients, uint256[6] memory amounts) ERC20("Infopunks", "IPX") {
        require(block.chainid == 4663, "wrong chain");
        require(constitution != bytes32(0) && supply > 0, "invalid birth");
        uint256 allocated;
        for (uint256 i; i < 6; ++i) allocated += amounts[i];
        require(allocated == supply, "allocation mismatch");
        require(recipients[5] == address(0), "burn recipient must be zero");
        constitutionSha256 = constitution;
        allocationHash = sha256(abi.encode(recipients, amounts));
        genesisBlock = block.number;
        genesisTimestamp = block.timestamp;
        initialSupply = supply;
        allocationAmount = amounts;
        allocationRecipient = recipients;
        for (uint256 i; i < 5; ++i) {
            if (amounts[i] > 0) { require(recipients[i] != address(0), "zero recipient"); _mint(recipients[i], amounts[i]); }
        }
        if (amounts[5] > 0) { _mint(address(this), amounts[5]); _burn(address(this), amounts[5]); }
        emit GenesisCertificate(block.chainid, address(this), block.number, block.timestamp, constitution, allocationHash, supply);
    }
}
