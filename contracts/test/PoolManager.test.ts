import { expect } from "chai";
import { ethers } from "hardhat";
import { PoolManager } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PoolManager", function () {
  let poolManager: PoolManager;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let referrer: SignerWithAddress;

  const MIN_DEPOSIT = ethers.parseEther("0.01");
  const MAX_DEPOSIT = ethers.parseEther("100");
  const APY_BPS = 1000; // 10%

  beforeEach(async function () {
    [owner, user1, user2, referrer] = await ethers.getSigners();
    const PoolManagerFactory = await ethers.getContractFactory("PoolManager");
    poolManager = await PoolManagerFactory.deploy();
    await poolManager.waitForDeployment();
  });

  // ═══════════════════════════════════════════════
  //  POOL CREATION
  // ═══════════════════════════════════════════════
  describe("Pool Creation", function () {
    it("Should create a pool successfully", async function () {
      await poolManager.createPool("Test Pool", MIN_DEPOSIT, MAX_DEPOSIT, APY_BPS);
      expect(await poolManager.poolCount()).to.equal(1);

      const [totalStaked, memberCount, apy, isActive] = await poolManager.getPoolInfo(0);
      expect(totalStaked).to.equal(0);
      expect(memberCount).to.equal(0);
      expect(apy).to.equal(APY_BPS);
      expect(isActive).to.be.true;
    });

    it("Should create multiple pools", async function () {
      await poolManager.createPool("Pool A", MIN_DEPOSIT, MAX_DEPOSIT, 500);
      await poolManager.createPool("Pool B", MIN_DEPOSIT, 0, 2000); // unlimited max
      expect(await poolManager.poolCount()).to.equal(2);
    });

    it("Should reject pool with empty name", async function () {
      await expect(
        poolManager.createPool("", MIN_DEPOSIT, MAX_DEPOSIT, APY_BPS)
      ).to.be.revertedWith("Pool name required");
    });

    it("Should reject pool with APY > 100%", async function () {
      await expect(
        poolManager.createPool("Bad Pool", MIN_DEPOSIT, MAX_DEPOSIT, 10001)
      ).to.be.revertedWith("APY exceeds maximum");
    });

    it("Should only allow owner to create pools", async function () {
      await expect(
        poolManager.connect(user1).createPool("Hack Pool", 0, 0, 100)
      ).to.be.revertedWithCustomError(poolManager, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════
  //  DEPOSITS
  // ═══════════════════════════════════════════════
  describe("Deposits", function () {
    beforeEach(async function () {
      await poolManager.createPool("Test Pool", MIN_DEPOSIT, MAX_DEPOSIT, APY_BPS);
    });

    it("Should deposit BNB successfully", async function () {
      const depositAmount = ethers.parseEther("1");
      await expect(poolManager.connect(user1).deposit(0, { value: depositAmount }))
        .to.emit(poolManager, "Deposited")
        .withArgs(user1.address, 0, depositAmount);

      expect(await poolManager.getUserStake(user1.address, 0)).to.equal(depositAmount);
      expect(await poolManager.totalValueLocked()).to.equal(depositAmount);
    });

    it("Should track member count correctly", async function () {
      await poolManager.connect(user1).deposit(0, { value: ethers.parseEther("1") });
      await poolManager.connect(user2).deposit(0, { value: ethers.parseEther("2") });

      const [, memberCount] = await poolManager.getPoolInfo(0);
      expect(memberCount).to.equal(2);
    });

    it("Should allow multiple deposits from same user", async function () {
      await poolManager.connect(user1).deposit(0, { value: ethers.parseEther("1") });
      await poolManager.connect(user1).deposit(0, { value: ethers.parseEther("2") });

      expect(await poolManager.getUserStake(user1.address, 0)).to.equal(ethers.parseEther("3"));

      // Member count should still be 1
      const [, memberCount] = await poolManager.getPoolInfo(0);
      expect(memberCount).to.equal(1);
    });

    it("Should reject deposit below minimum", async function () {
      await expect(
        poolManager.connect(user1).deposit(0, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Below minimum deposit");
    });

    it("Should reject deposit above maximum", async function () {
      await expect(
        poolManager.connect(user1).deposit(0, { value: ethers.parseEther("101") })
      ).to.be.revertedWith("Exceeds maximum deposit");
    });

    it("Should reject deposit to inactive pool", async function () {
      await poolManager.updatePool(0, false, APY_BPS);
      await expect(
        poolManager.connect(user1).deposit(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Pool is not active");
    });

    it("Should reject deposit to non-existent pool", async function () {
      await expect(
        poolManager.connect(user1).deposit(99, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Pool does not exist");
    });
  });

  // ═══════════════════════════════════════════════
  //  WITHDRAWALS
  // ═══════════════════════════════════════════════
  describe("Withdrawals", function () {
    beforeEach(async function () {
      await poolManager.createPool("Test Pool", MIN_DEPOSIT, MAX_DEPOSIT, APY_BPS);
      await poolManager.connect(user1).deposit(0, { value: ethers.parseEther("5") });
    });

    it("Should withdraw partial amount", async function () {
      const withdrawAmount = ethers.parseEther("2");
      await expect(poolManager.connect(user1).withdraw(0, withdrawAmount))
        .to.emit(poolManager, "Withdrawn")
        .withArgs(user1.address, 0, withdrawAmount);

      expect(await poolManager.getUserStake(user1.address, 0)).to.equal(ethers.parseEther("3"));
    });

    it("Should withdraw full amount", async function () {
      await poolManager.connect(user1).withdraw(0, ethers.parseEther("5"));
      expect(await poolManager.getUserStake(user1.address, 0)).to.equal(0);
    });

    it("Should update TVL on withdrawal", async function () {
      const before = await poolManager.totalValueLocked();
      await poolManager.connect(user1).withdraw(0, ethers.parseEther("2"));
      const after = await poolManager.totalValueLocked();
      expect(before - after).to.equal(ethers.parseEther("2"));
    });

    it("Should reject over-withdrawal", async function () {
      await expect(
        poolManager.connect(user1).withdraw(0, ethers.parseEther("10"))
      ).to.be.revertedWith("Insufficient staked balance");
    });

    it("Should reject withdrawal with no stake", async function () {
      await expect(
        poolManager.connect(user2).withdraw(0, ethers.parseEther("1"))
      ).to.be.revertedWith("No stake found");
    });

    it("Should reject zero withdrawal", async function () {
      await expect(
        poolManager.connect(user1).withdraw(0, 0)
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  // ═══════════════════════════════════════════════
  //  REFERRAL SYSTEM
  // ═══════════════════════════════════════════════
  describe("Referral System", function () {
    beforeEach(async function () {
      await poolManager.createPool("Test Pool", MIN_DEPOSIT, MAX_DEPOSIT, APY_BPS);
    });

    it("Should register referral", async function () {
      await expect(poolManager.connect(user1).registerReferral(referrer.address))
        .to.emit(poolManager, "ReferralRegistered")
        .withArgs(user1.address, referrer.address);

      const [ref, , isRegistered] = await poolManager.getReferralInfo(user1.address);
      expect(ref).to.equal(referrer.address);
      expect(isRegistered).to.be.true;
    });

    it("Should not register self-referral", async function () {
      await expect(
        poolManager.connect(user1).registerReferral(user1.address)
      ).to.be.revertedWith("Cannot refer yourself");
    });

    it("Should not register duplicate referral", async function () {
      await poolManager.connect(user1).registerReferral(referrer.address);
      await expect(
        poolManager.connect(user1).registerReferral(user2.address)
      ).to.be.revertedWith("Referral already registered");
    });

    it("Should pay referral bonus on deposit", async function () {
      // Fund contract for referral payouts
      await poolManager.fundRewards({ value: ethers.parseEther("10") });

      await poolManager.connect(user1).registerReferral(referrer.address);

      const balanceBefore = await ethers.provider.getBalance(referrer.address);
      const depositAmount = ethers.parseEther("1");

      await poolManager.connect(user1).deposit(0, { value: depositAmount });

      const balanceAfter = await ethers.provider.getBalance(referrer.address);
      const expectedBonus = depositAmount * BigInt(500) / BigInt(10000); // 5%
      expect(balanceAfter - balanceBefore).to.equal(expectedBonus);
    });

    it("Should track referred users", async function () {
      await poolManager.connect(user1).registerReferral(referrer.address);
      await poolManager.connect(user2).registerReferral(referrer.address);

      const referred = await poolManager.getReferredUsers(referrer.address);
      expect(referred.length).to.equal(2);
      expect(referred[0]).to.equal(user1.address);
      expect(referred[1]).to.equal(user2.address);
    });

    it("Should update referral bonus rate", async function () {
      await poolManager.setReferralBonus(300); // 3%
      expect(await poolManager.referralBonusBps()).to.equal(300);
    });

    it("Should reject referral bonus > 20%", async function () {
      await expect(
        poolManager.setReferralBonus(2001)
      ).to.be.revertedWith("Referral bonus too high");
    });
  });

  // ═══════════════════════════════════════════════
  //  REWARDS
  // ═══════════════════════════════════════════════
  describe("Rewards", function () {
    beforeEach(async function () {
      await poolManager.createPool("Test Pool", MIN_DEPOSIT, MAX_DEPOSIT, APY_BPS);
      // Fund contract for reward payouts
      await poolManager.fundRewards({ value: ethers.parseEther("100") });
    });

    it("Should calculate pending rewards after time passes", async function () {
      await poolManager.connect(user1).deposit(0, { value: ethers.parseEther("10") });

      // Advance time by 365 days
      await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      const pending = await poolManager.pendingRewards(0, user1.address);
      // 10 BNB * 10% APY * 1 year = ~1 BNB
      expect(pending).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.01"));
    });

    it("Should claim rewards successfully", async function () {
      await poolManager.connect(user1).deposit(0, { value: ethers.parseEther("10") });

      // Advance 30 days
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(poolManager.connect(user1).claimRewards(0))
        .to.emit(poolManager, "RewardsClaimed");
    });

    it("Should reject claim with no stake", async function () {
      // user2 never deposited — no stake at all
      await expect(
        poolManager.connect(user2).claimRewards(0)
      ).to.be.revertedWith("No rewards to claim");
    });

    it("Should return user stake info correctly", async function () {
      await poolManager.connect(user1).deposit(0, { value: ethers.parseEther("5") });

      const [amount, , , ] = await poolManager.getUserStakeInfo(user1.address, 0);
      expect(amount).to.equal(ethers.parseEther("5"));
    });
  });

  // ═══════════════════════════════════════════════
  //  ADMIN FUNCTIONS
  // ═══════════════════════════════════════════════
  describe("Admin Functions", function () {
    it("Should pause and unpause", async function () {
      await poolManager.createPool("Test Pool", MIN_DEPOSIT, MAX_DEPOSIT, APY_BPS);

      await poolManager.pause();
      await expect(
        poolManager.connect(user1).deposit(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(poolManager, "EnforcedPause");

      await poolManager.unpause();
      await poolManager.connect(user1).deposit(0, { value: ethers.parseEther("1") });
    });

    it("Should fund rewards", async function () {
      const amount = ethers.parseEther("50");
      await poolManager.fundRewards({ value: amount });
      expect(await ethers.provider.getBalance(await poolManager.getAddress())).to.equal(amount);
    });

    it("Should emergency withdraw", async function () {
      await poolManager.fundRewards({ value: ethers.parseEther("10") });
      const balanceBefore = await ethers.provider.getBalance(owner.address);

      const tx = await poolManager.emergencyWithdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter + gasUsed - balanceBefore).to.be.closeTo(
        ethers.parseEther("10"),
        ethers.parseEther("0.001")
      );
    });

    it("Should update pool", async function () {
      await poolManager.createPool("Test Pool", MIN_DEPOSIT, MAX_DEPOSIT, APY_BPS);
      await poolManager.updatePool(0, false, 2000);

      const [, , apy, isActive] = await poolManager.getPoolInfo(0);
      expect(isActive).to.be.false;
      expect(apy).to.equal(2000);
    });

    it("Should reject non-owner admin calls", async function () {
      await expect(
        poolManager.connect(user1).pause()
      ).to.be.revertedWithCustomError(poolManager, "OwnableUnauthorizedAccount");

      await expect(
        poolManager.connect(user1).emergencyWithdraw()
      ).to.be.revertedWithCustomError(poolManager, "OwnableUnauthorizedAccount");
    });
  });
});
