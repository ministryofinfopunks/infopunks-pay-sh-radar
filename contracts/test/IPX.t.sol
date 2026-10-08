// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IPX} from "../src/IPX.sol";
import {IPXGenesisCertificate} from "../src/IPXGenesisCertificate.sol";
import {IPXGenesisCalls} from "../src/IPXGenesisCalls.sol";
import {PulseCommitment} from "../src/PulseCommitment.sol";
import {IPXContributionVault, IExactInputRouter, IBurnableIPX} from "../src/IPXContributionVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
interface Vm { function getNonce(address) external view returns(uint64); function computeCreateAddress(address,uint256) external pure returns(address); function chainId(uint256) external; function expectRevert() external; function prank(address) external; function etch(address, bytes calldata) external; function warp(uint256) external; }
contract MockUSDG is ERC20 { constructor() ERC20("Global Dollar", "USDG") {} function mint(address to, uint256 amount) external { _mint(to, amount); } }
contract TestRouter is IExactInputRouter {
    ERC20 public token; bool public fail;
    constructor(ERC20 ipx) { token = ipx; }
    function setFail(bool value) external { fail = value; }
    function exactInput(ExactInputParams calldata p) external payable returns(uint256) {
        require(!fail, "router failed");
        ERC20(0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168).transferFrom(msg.sender, address(this), p.amountIn);
        token.transfer(p.recipient, p.amountOutMinimum); return p.amountOutMinimum;
    }
}
contract IPXTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function token() internal returns(IPX) {
        vm.chainId(4663);
        address[6] memory to = [address(this), address(this), address(this), address(this), address(this), address(0)];
        uint256[6] memory amount = [uint256(4663), uint256(4663), uint256(10000), uint256(20000), uint256(10000), uint256(674)];
        return new IPX(sha256("constitution"), 50000, to, amount);
    }
    function testFixedSupplyAllocationsAndBurn() public {
        IPX ipx = token(); require(ipx.totalSupply() == 49326 && ipx.initialSupply() == 50000);
        ipx.transfer(address(123), 100); require(ipx.totalSupply() == 49326);
        ipx.burn(1000); require(ipx.totalSupply() == 48326);
        (bool success,) = address(ipx).call(abi.encodeWithSignature("mint(address,uint256)", address(this), 1)); require(!success);
    }
    function testWrongChainAndAllocationMismatch() public {
        address[6] memory to; uint256[6] memory amounts;
        bytes32 constitution = sha256("constitution"); vm.chainId(1); vm.expectRevert(); new IPX(constitution, 100, to, amounts);
        vm.chainId(4663); vm.expectRevert(); new IPX(constitution, 100, to, amounts);
    }
    function testCohortFundingSealClaimAndReplay() public {
        IPX ipx = token(); IPXGenesisCalls claims = new IPXGenesisCalls(ipx, address(this), 4663);
        bytes32 callHash = sha256("call");
        bytes32 leaf = sha256(abi.encodePacked("ipx.genesis.entitlement.v2", uint256(4663), address(claims), uint256(1), address(this), uint256(1), callHash));
        vm.expectRevert(); claims.seal(leaf, 4663);
        ipx.transfer(address(claims), 4663); claims.seal(leaf, 4663);
        uint256 beforeBalance = ipx.balanceOf(address(this)); bytes32[] memory proof = new bytes32[](0);
        claims.claim(1, callHash, proof); require(ipx.balanceOf(address(this)) == beforeBalance + 1);
        vm.expectRevert(); claims.claim(1, callHash, proof);
        bytes32 replacement = sha256("replacement"); vm.expectRevert(); claims.seal(replacement, 4663);
        vm.prank(address(123)); vm.expectRevert(); claims.claim(2, callHash, proof);
    }
    function testCertificateRequiresCanonicalFundedSealedDistributor() public {
        vm.chainId(4663);
        IPX wrong = token(); IPXGenesisCalls wrongCalls = new IPXGenesisCalls(wrong, address(this), 4663);
        vm.expectRevert(); new IPXGenesisCertificate(wrong, wrongCalls);
        wrong.transfer(address(wrongCalls), 4663); wrongCalls.seal(sha256("root"), 4663);
        vm.expectRevert(); new IPXGenesisCertificate(wrong, wrongCalls);
        address predicted = vm.computeCreateAddress(address(this), uint256(vm.getNonce(address(this))) + 1);
        address[6] memory recipients = [address(this), predicted, address(this), address(this), address(this), address(0)];
        uint256[6] memory amounts = [uint256(4663), uint256(4663), uint256(0), uint256(0), uint256(0), uint256(0)];
        IPX ipx = new IPX(sha256("constitution"), 9326, recipients, amounts);
        IPXGenesisCalls calls = new IPXGenesisCalls(ipx, address(this), 4663);
        require(address(calls) == predicted);
        bytes32 root = sha256("complete cohort"); calls.seal(root, 4663);
        IPXGenesisCertificate certificate = new IPXGenesisCertificate(ipx, calls);
        require(certificate.cohortRoot() == root && certificate.genesisBlock() == ipx.genesisBlock());
        require(certificate.constitutionSha256() == ipx.constitutionSha256() && certificate.COHORT_CALLS() == 4663);
    }
    function testCommitmentCannotBeOverwrittenOrForged() public {
        vm.chainId(4663); vm.warp(1000); PulseCommitment anchor = new PulseCommitment(address(this));
        bytes32 window = sha256("window"); anchor.commitPulseWindow(window, sha256("root"), 3, 900);
        bytes32 replacement = sha256("replacement"); vm.expectRevert(); anchor.commitPulseWindow(window, replacement, 3, 900);
        bytes32 other = sha256("other"); bytes32 root = sha256("root"); vm.prank(address(123)); vm.expectRevert(); anchor.commitPulseWindow(other, root, 3, 900);
    }
    function testContributionPurchaseBurnAndRetrySafety() public {
        IPX ipx = token(); MockUSDG usdg = new MockUSDG(); vm.etch(0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168, address(usdg).code);
        MockUSDG usd = MockUSDG(0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168);
        TestRouter router = new TestRouter(ipx); MockUSDG pltr = new MockUSDG();
        IPXContributionVault vault = new IPXContributionVault(IBurnableIPX(address(ipx)), pltr, router, address(this), address(123), 5000, 3000, 3000);
        usd.mint(address(vault), 10000); ipx.transfer(address(router), 1000);
        bytes32 source = sha256("verified revenue"); vault.recordContribution(source, 10000, 1000, 500, 500, 0);
        require(vault.reserved() == 4000 && usd.balanceOf(address(123)) == 6000);
        vm.expectRevert(); vault.recordContribution(source, 10000, 0, 0, 0, 0);
        router.setFail(true); vm.expectRevert(); vault.buyAndBurn(source, 500, block.timestamp + 60);
        require(vault.reserved() == 4000);
        router.setFail(false); uint256 beforeSupply = ipx.totalSupply(); vault.buyAndBurn(source, 500, block.timestamp + 60);
        require(ipx.totalSupply() == beforeSupply - 500 && vault.reserved() == 0);
        require(usd.allowance(address(vault), address(router)) == 0);
        vm.expectRevert(); vault.buyAndBurn(source, 500, block.timestamp + 60);
    }
}
