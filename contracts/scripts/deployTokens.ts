import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Deploy all 3 CLB tokens (BEP-20) to BSC:
 * - CLB  (Standard tier)
 * - CLBg (Gold tier)
 * - CLBs (Silver tier)
 *
 * After deployment, add the contract addresses to Trust Wallet
 * as custom tokens (BEP-20 network) to see balances.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════");
  console.log("  CLB Tokens — Deployment Script");
  console.log("═══════════════════════════════════════════");
  console.log(`  Network:  ${network.name}`);
  console.log(`  Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB`);
  console.log("═══════════════════════════════════════════\n");

  const tokens = [
    { name: "CryptoLoanBoost", symbol: "CLB", decimals: 18, initialSupply: 1_000_000 },
    { name: "CryptoLoanBoost Gold", symbol: "CLBg", decimals: 18, initialSupply: 100_000 },
    { name: "CryptoLoanBoost Silver", symbol: "CLBs", decimals: 18, initialSupply: 500_000 },
  ];

  const deployedTokens: Record<string, any> = {};

  for (const token of tokens) {
    console.log(`📦 Deploying ${token.symbol} (${token.name})...`);

    const CLBToken = await ethers.getContractFactory("CLBToken");
    const contract = await CLBToken.deploy(
      token.name,
      token.symbol,
      token.decimals,
      token.initialSupply
    );
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`✅ ${token.symbol} deployed at: ${address}`);

    deployedTokens[token.symbol] = {
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      initialSupply: token.initialSupply,
      address,
    };
  }

  // ─── Save deployment info ──────────────────────
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const deploymentInfo = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    tokens: deployedTokens,
  };

  const deploymentFile = path.join(deploymentsDir, `tokens-${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📄 Deployment info saved to ${deploymentFile}`);

  // ─── Copy ABI ──────────────────────────────────
  const artifactPath = path.join(__dirname, "../artifacts/solidity/CLBToken.sol/CLBToken.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abiDir = path.join(__dirname, "../abi");
    if (!fs.existsSync(abiDir)) fs.mkdirSync(abiDir, { recursive: true });
    fs.writeFileSync(path.join(abiDir, "CLBToken.json"), JSON.stringify(artifact.abi, null, 2));
    console.log(`📋 ABI saved to abi/CLBToken.json`);
  }

  // ─── Update .env ───────────────────────────────
  const envPath = path.join(__dirname, "../../.env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");

    const envVars: Record<string, string> = {
      CLB_TOKEN_ADDRESS: deployedTokens.CLB.address,
      CLBG_TOKEN_ADDRESS: deployedTokens.CLBg.address,
      CLBS_TOKEN_ADDRESS: deployedTokens.CLBs.address,
    };

    for (const [key, value] of Object.entries(envVars)) {
      const regex = new RegExp(`${key}=.*`);
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`🔧 Updated .env with token addresses`);
  }

  // ─── Summary ───────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("  ALL TOKENS DEPLOYED!");
  console.log("═══════════════════════════════════════════");
  console.log(`  CLB:  ${deployedTokens.CLB.address}`);
  console.log(`  CLBg: ${deployedTokens.CLBg.address}`);
  console.log(`  CLBs: ${deployedTokens.CLBs.address}`);
  console.log("═══════════════════════════════════════════");
  console.log("\n📱 Trust Wallet Setup:");
  console.log("  1. Open Trust Wallet → Add Custom Token");
  console.log("  2. Network: BNB Smart Chain (BEP-20)");
  console.log("  3. Paste the contract address above");
  console.log("  4. Symbol, decimals auto-fill");
  console.log("  5. Done! Token will show in wallet\n");

  // Verify reminder
  if (network.name === "bscTestnet" || network.name === "bscMainnet") {
    console.log(`🔍 To verify on BscScan:`);
    for (const [symbol, info] of Object.entries(deployedTokens)) {
      const token = tokens.find(t => t.symbol === symbol)!;
      console.log(`   npx hardhat verify --network ${network.name} ${info.address} "${token.name}" "${token.symbol}" ${token.decimals} ${token.initialSupply}`);
    }
  }
}

main().catch((error) => {
  console.error("❌ Token deployment failed:", error);
  process.exitCode = 1;
});
