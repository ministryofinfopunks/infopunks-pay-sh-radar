// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
interface IBurnableIPX is IERC20 { function burn(uint256 amount) external; }
interface IExactInputRouter {
    struct ExactInputParams { bytes path; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}
/// Reviewed cost attribution is explicit accountant authority, not permissionless economic truth.
/// Router and USDG->PLTR->IPX path are immutable; this contract cannot mint or change policy.
contract IPXContributionVault is ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    IBurnableIPX public immutable ipx;
    IERC20 public immutable pltr;
    IExactInputRouter public immutable router;
    address public immutable accountant;
    address public immutable operations;
    uint256 public immutable burnBps;
    uint24 public immutable usdgPltrFee;
    uint24 public immutable pltrIpxFee;
    uint256 public reserved;
    struct Contribution { uint256 gross; uint256 costs; uint256 purchaseBudget; bool executed; }
    mapping(bytes32 => Contribution) public contributions;
    event ContributionRecorded(bytes32 indexed revenueReceiptHash, uint256 gross, uint256 infra, uint256 data, uint256 facilitator, uint256 refunds, uint256 net, uint256 purchaseBudget);
    event IPXPurchasedAndBurned(bytes32 indexed revenueReceiptHash, uint256 usdgSpent, uint256 ipxBurned);
    constructor(IBurnableIPX token, IERC20 quote, IExactInputRouter venue, address costAuthority, address costRecipient, uint256 bps, uint24 firstFee, uint24 secondFee) {
        require(block.chainid == 4663 && address(token).code.length > 0 && address(quote).code.length > 0 && address(venue).code.length > 0, "unverified deployment");
        require(costAuthority != address(0) && costRecipient != address(0) && bps > 0 && bps <= 10000 && firstFee > 0 && secondFee > 0, "invalid policy");
        require(address(token) != USDG && address(quote) != USDG && address(token) != address(quote), "invalid path");
        ipx = token; pltr = quote; router = venue; accountant = costAuthority; operations = costRecipient; burnBps = bps; usdgPltrFee = firstFee; pltrIpxFee = secondFee;
    }
    function recordContribution(bytes32 revenueHash, uint256 gross, uint256 infra, uint256 data, uint256 facilitator, uint256 refunds) external nonReentrant {
        require(msg.sender == accountant && revenueHash != bytes32(0) && contributions[revenueHash].gross == 0 && gross > 0, "invalid revenue");
        require(IERC20(USDG).balanceOf(address(this)) >= reserved + gross, "unfunded revenue");
        uint256 costs = infra + data + facilitator + refunds;
        // Losses reserve zero for purchases; costs must never consume an earlier contribution.
        uint256 net = gross > costs ? gross - costs : 0;
        uint256 budget = Math.mulDiv(net, burnBps, 10000);
        contributions[revenueHash] = Contribution(gross, costs, budget, false);
        reserved += budget;
        IERC20(USDG).safeTransfer(operations, gross - budget);
        emit ContributionRecorded(revenueHash, gross, infra, data, facilitator, refunds, net, budget);
    }
    function buyAndBurn(bytes32 revenueHash, uint256 minIpxOut, uint256 deadline) external nonReentrant {
        require(msg.sender == accountant && minIpxOut > 0 && deadline >= block.timestamp && deadline <= block.timestamp + 15 minutes, "invalid execution");
        Contribution storage contribution = contributions[revenueHash];
        require(contribution.purchaseBudget > 0 && !contribution.executed, "nothing to execute");
        contribution.executed = true;
        uint256 budget = contribution.purchaseBudget; reserved -= budget;
        uint256 beforeBalance = ipx.balanceOf(address(this));
        uint256 beforeUsdG = IERC20(USDG).balanceOf(address(this));
        IERC20(USDG).forceApprove(address(router), budget);
        router.exactInput(IExactInputRouter.ExactInputParams(abi.encodePacked(USDG, usdgPltrFee, address(pltr), pltrIpxFee, address(ipx)), address(this), deadline, budget, minIpxOut));
        IERC20(USDG).forceApprove(address(router), 0);
        require(beforeUsdG - IERC20(USDG).balanceOf(address(this)) == budget, "input spend mismatch");
        uint256 received = ipx.balanceOf(address(this)) - beforeBalance;
        require(received >= minIpxOut, "purchase not received");
        ipx.burn(received);
        emit IPXPurchasedAndBurned(revenueHash, budget, received);
    }
}
