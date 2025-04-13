// scripts/deploy.ts

import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { ELECTION_CONFIG } from "../src/config/election";

async function main() {
    console.log("Deploying VotingRegistration contract...");

    const VotingRegistration = await ethers.getContractFactory("VotingRegistration");
    
    // Create mutable arrays using spread operator
    const deploymentConfig = {
        registrationDuration: ELECTION_CONFIG.timing.registrationDuration,
        submissionDuration: ELECTION_CONFIG.timing.submissionDuration,
        votingDuration: ELECTION_CONFIG.timing.votingDuration,
        candidates: [...ELECTION_CONFIG.candidates],
        allowedDomains: [...ELECTION_CONFIG.domains.allowed]
    };

    const votingRegistration = await VotingRegistration.deploy(
        deploymentConfig.registrationDuration,
        deploymentConfig.submissionDuration,
        deploymentConfig.votingDuration,
        deploymentConfig.candidates,
        deploymentConfig.allowedDomains
    );

    await votingRegistration.waitForDeployment();
    const contractAddress = await votingRegistration.getAddress();
    console.log("VotingRegistration deployed to:", contractAddress);

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contract with the account:", deployer.address);
    const balance = await deployer.provider.getBalance(deployer.address);
    const balanceInTBNB = ethers.formatEther(balance);
    console.log("Account balance:", balanceInTBNB, "tBNB");

    // Update constant file with new address and ABI
    const artifactPath = path.join(__dirname, "../src/artifacts/contracts/VotingRegistration.sol/VotingRegistration.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    const constantsPath = path.join(__dirname, "../src/constant/index.ts");
    const constantsContent = fs.readFileSync(constantsPath, "utf8");

    // Update contract address
    const updatedContent = constantsContent.replace(
        /export const VOTING_CONTRACT_ADDRESS = ".*";/,
        `export const VOTING_CONTRACT_ADDRESS = "${contractAddress}";`
    );

    // Update ABI
    const finalContent = updatedContent.replace(
        /export const VOTING_CONTRACT_ABI = \[[\s\S]*?\];/,
        `export const VOTING_CONTRACT_ABI = ${JSON.stringify(artifact.abi, null, 2)};`
    );

    fs.writeFileSync(constantsPath, finalContent);
    console.log("Contract address and ABI updated in constants file");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });