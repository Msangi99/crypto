import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════");
  console.log("  CLB PoolManager — Deployment Script");
  console.log("═══════════════════════════════════════════");
  console.log(`  Network:  ${network.name}`);
  console.log(`  Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB`);
  console.log("═══════════════════════════════════════════\n");

  // Deploy PoolManager
  console.log("📦 Deploying PoolManager...");
  const PoolManager = await ethers.getContractFactory("PoolManager");
  const poolManager = await PoolManager.deploy();
  await poolManager.waitForDeployment();

  const contractAddress = await poolManager.getAddress();
  console.log(`✅ PoolManager deployed at: ${contractAddress}\n`);

  // Skip pool creation to save gas — create pools later via backend or separate script
  console.log("💡 Pool creation skipped (save gas). Create pools via contract after deployment.\n");

  // ─── Save deployment info ──────────────────────
  const deploymentInfo = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    contractAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
  };

  // Save to contracts/deployments/
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📄 Deployment info saved to ${deploymentFile}`);

  // ─── Copy ABI to backend ──────────────────────
  const artifactPath = path.join(__dirname, "../artifacts/solidity/PoolManager.sol/PoolManager.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abiOutputPath = path.join(__dirname, "../abi/PoolManager.json");
    fs.writeFileSync(abiOutputPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`📋 ABI copied to ${abiOutputPath}`);
  }

  // ─── Update root .env ─────────────────────────
  const envPath = path.join(__dirname, "../../.env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");
    envContent = envContent.replace(
      /POOL_MANAGER_CONTRACT=.*/,
      `POOL_MANAGER_CONTRACT=${contractAddress}`
    );
    fs.writeFileSync(envPath, envContent);
    console.log(`🔧 Updated .env with contract address`);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE!");
  console.log(`  Contract: ${contractAddress}`);
  console.log("═══════════════════════════════════════════");

  // Verify reminder
  if (network.name === "bscTestnet" || network.name === "bscMainnet") {
    console.log(`\n🔍 To verify on BscScan:`);
    console.log(`   npx hardhat verify --network ${network.name} ${contractAddress}`);
  }
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
