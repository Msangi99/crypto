// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PoolManager
 * @notice CLB DApp — Staking pools with BNB deposits, withdrawals, rewards, and referrals
 * @dev Deployed on BSC (Testnet chain ID 97 / Mainnet chain ID 56)
 */
contract PoolManager is Ownable, ReentrancyGuard, Pausable {

    // ─── Structs ─────────────────────────────────────
    struct Pool {
        string name;
        uint256 minDeposit;       // Minimum deposit in wei
        uint256 maxDeposit;       // Maximum deposit in wei (0 = unlimited)
        uint256 apy;              // APY in basis points (e.g., 1000 = 10%)
        uint256 totalStaked;      // Total BNB staked in pool
        uint256 memberCount;      // Number of unique stakers
        bool isActive;            // Pool status
        uint256 createdAt;
    }

    struct UserStake {
        uint256 amount;           // Amount staked in wei
        uint256 depositTime;      // When last deposit was made
        uint256 claimedRewards;   // Total rewards already claimed
        bool exists;              // Whether user has ever staked in this pool
    }

    struct ReferralInfo {
        address referrer;         // Who referred this user
        uint256 totalReward;      // Total referral rewards earned by referrer from this user
        bool isRegistered;        // Whether referral is registered
    }

    // ─── State Variables ─────────────────────────────
    uint256 public poolCount;
    uint256 public referralBonusBps = 500; // 5% of deposit goes to referrer
    uint256 public constant MAX_BPS = 10000;
    uint256 public totalValueLocked;

    // poolId => Pool
    mapping(uint256 => Pool) public pools;

    // poolId => user => UserStake
    mapping(uint256 => mapping(address => UserStake)) public userStakes;

    // user => ReferralInfo
    mapping(address => ReferralInfo) public referrals;

    // referrer => list of referred addresses
    mapping(address => address[]) public referredUsers;

    // ─── Events ──────────────────────────────────────
    event PoolCreated(uint256 indexed poolId, string name, uint256 apy);
    event PoolUpdated(uint256 indexed poolId, bool isActive, uint256 apy);
    event Deposited(address indexed user, uint256 indexed poolId, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed poolId, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 indexed poolId, uint256 reward);
    event ReferralRegistered(address indexed referred, address indexed referrer);
    event ReferralRewarded(address indexed referrer, address indexed referred, uint256 reward);
    event ReferralBonusUpdated(uint256 oldBps, uint256 newBps);

    // ─── Constructor ─────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ─── Pool Management (Owner Only) ────────────────

    /**
     * @notice Create a new staking pool
     * @param _name Pool name
     * @param _minDeposit Minimum deposit in wei
     * @param _maxDeposit Maximum deposit in wei (0 = unlimited)
     * @param _apy APY in basis points (1000 = 10%)
     */
    function createPool(
        string calldata _name,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _apy
    ) external onlyOwner {
        require(bytes(_name).length > 0, "Pool name required");
        require(_apy <= MAX_BPS, "APY exceeds maximum");

        uint256 poolId = poolCount;
        pools[poolId] = Pool({
            name: _name,
            minDeposit: _minDeposit,
            maxDeposit: _maxDeposit,
            apy: _apy,
            totalStaked: 0,
            memberCount: 0,
            isActive: true,
            createdAt: block.timestamp
        });

        poolCount++;
        emit PoolCreated(poolId, _name, _apy);
    }

    /**
     * @notice Update pool status and APY
     */
    function updatePool(uint256 _poolId, bool _isActive, uint256 _apy) external onlyOwner {
        require(_poolId < poolCount, "Pool does not exist");
        require(_apy <= MAX_BPS, "APY exceeds maximum");

        pools[_poolId].isActive = _isActive;
        pools[_poolId].apy = _apy;

        emit PoolUpdated(_poolId, _isActive, _apy);
    }

    /**
     * @notice Update referral bonus percentage
     */
    function setReferralBonus(uint256 _bps) external onlyOwner {
        require(_bps <= 2000, "Referral bonus too high"); // Max 20%
        uint256 old = referralBonusBps;
        referralBonusBps = _bps;
        emit ReferralBonusUpdated(old, _bps);
    }

    // ─── Referral System ─────────────────────────────

    /**
     * @notice Register a referrer for the caller
     * @param _referrer Address of the person who referred you
     */
    function registerReferral(address _referrer) external {
        require(_referrer != address(0), "Invalid referrer");
        require(_referrer != msg.sender, "Cannot refer yourself");
        require(!referrals[msg.sender].isRegistered, "Referral already registered");

        referrals[msg.sender] = ReferralInfo({
            referrer: _referrer,
            totalReward: 0,
            isRegistered: true
        });

        referredUsers[_referrer].push(msg.sender);

        emit ReferralRegistered(msg.sender, _referrer);
    }

    // ─── Deposit ─────────────────────────────────────

    /**
     * @notice Deposit BNB into a pool
     * @param _poolId ID of the pool to deposit into
     */
    function deposit(uint256 _poolId) external payable nonReentrant whenNotPaused {
        require(_poolId < poolCount, "Pool does not exist");
        Pool storage pool = pools[_poolId];
        require(pool.isActive, "Pool is not active");
        require(msg.value >= pool.minDeposit, "Below minimum deposit");
        if (pool.maxDeposit > 0) {
            require(
                userStakes[_poolId][msg.sender].amount + msg.value <= pool.maxDeposit,
                "Exceeds maximum deposit"
            );
        }

        UserStake storage stake = userStakes[_poolId][msg.sender];

        // New member tracking
        if (!stake.exists) {
            stake.exists = true;
            pool.memberCount++;
        }

        stake.amount += msg.value;
        stake.depositTime = block.timestamp;
        pool.totalStaked += msg.value;
        totalValueLocked += msg.value;

        emit Deposited(msg.sender, _poolId, msg.value);

        // Process referral bonus
        _processReferralBonus(msg.sender, msg.value);
    }

    // ─── Withdraw ────────────────────────────────────

    /**
     * @notice Withdraw BNB from a pool
     * @param _poolId Pool to withdraw from
     * @param _amount Amount to withdraw in wei
     */
    function withdraw(uint256 _poolId, uint256 _amount) external nonReentrant whenNotPaused {
        require(_poolId < poolCount, "Pool does not exist");
        UserStake storage stake = userStakes[_poolId][msg.sender];
        require(stake.exists, "No stake found");
        require(stake.amount >= _amount, "Insufficient staked balance");
        require(_amount > 0, "Amount must be > 0");

        stake.amount -= _amount;
        pools[_poolId].totalStaked -= _amount;
        totalValueLocked -= _amount;

        // Transfer BNB back to user
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        require(success, "BNB transfer failed");

        emit Withdrawn(msg.sender, _poolId, _amount);
    }

    // ─── Rewards ─────────────────────────────────────

    /**
     * @notice Calculate pending rewards for a user in a pool
     * @dev reward = (staked * apy * timeElapsed) / (365 days * MAX_BPS)
     */
    function pendingRewards(uint256 _poolId, address _user) public view returns (uint256) {
        UserStake storage stake = userStakes[_poolId][_user];
        if (!stake.exists || stake.amount == 0) return 0;

        uint256 timeElapsed = block.timestamp - stake.depositTime;
        uint256 reward = (stake.amount * pools[_poolId].apy * timeElapsed) / (365 days * MAX_BPS);

        return reward;
    }

    /**
     * @notice Claim pending rewards from a pool
     */
    function claimRewards(uint256 _poolId) external nonReentrant whenNotPaused {
        uint256 reward = pendingRewards(_poolId, msg.sender);
        require(reward > 0, "No rewards to claim");
        require(address(this).balance >= reward, "Insufficient contract balance for rewards");

        UserStake storage stake = userStakes[_poolId][msg.sender];
        stake.claimedRewards += reward;
        stake.depositTime = block.timestamp; // Reset timer

        (bool success, ) = payable(msg.sender).call{value: reward}("");
        require(success, "Reward transfer failed");

        emit RewardsClaimed(msg.sender, _poolId, reward);
    }

    // ─── Internal ────────────────────────────────────

    function _processReferralBonus(address _depositor, uint256 _depositAmount) internal {
        ReferralInfo storage ref = referrals[_depositor];
        if (!ref.isRegistered) return;

        uint256 bonus = (_depositAmount * referralBonusBps) / MAX_BPS;
        if (bonus == 0 || address(this).balance < bonus) return;

        ref.totalReward += bonus;

        (bool success, ) = payable(ref.referrer).call{value: bonus}("");
        if (success) {
            emit ReferralRewarded(ref.referrer, _depositor, bonus);
        }
    }

    // ─── View Functions ──────────────────────────────

    function getPoolInfo(uint256 _poolId) external view returns (
        uint256 _totalStaked,
        uint256 _memberCount,
        uint256 _apy,
        bool _isActive
    ) {
        require(_poolId < poolCount, "Pool does not exist");
        Pool storage pool = pools[_poolId];
        return (pool.totalStaked, pool.memberCount, pool.apy, pool.isActive);
    }

    function getUserStake(address _user, uint256 _poolId) external view returns (uint256) {
        return userStakes[_poolId][_user].amount;
    }

    function getUserStakeInfo(address _user, uint256 _poolId) external view returns (
        uint256 amount,
        uint256 depositTime,
        uint256 claimedRewards,
        uint256 pending
    ) {
        UserStake storage stake = userStakes[_poolId][_user];
        return (
            stake.amount,
            stake.depositTime,
            stake.claimedRewards,
            pendingRewards(_poolId, _user)
        );
    }

    function getReferralInfo(address _user) external view returns (
        address referrer,
        uint256 totalReward,
        bool isRegistered,
        uint256 referredCount
    ) {
        ReferralInfo storage ref = referrals[_user];
        return (
            ref.referrer,
            ref.totalReward,
            ref.isRegistered,
            referredUsers[_user].length
        );
    }

    function getReferredUsers(address _referrer) external view returns (address[] memory) {
        return referredUsers[_referrer];
    }

    // ─── Admin Functions ─────────────────────────────

    /**
     * @notice Fund contract for reward payouts
     */
    function fundRewards() external payable onlyOwner {
        require(msg.value > 0, "Must send BNB");
    }

    /**
     * @notice Emergency withdraw all BNB (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Allow contract to receive BNB
    receive() external payable {}
}
