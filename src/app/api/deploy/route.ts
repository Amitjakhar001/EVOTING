// src/app/api/deploy/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { isAdmin } from '@/config/admin';
import VotingRegistrationArtifact from '@/artifacts/contracts/VotingRegistration.sol/VotingRegistration.json';
import { updateGithubAndDeploy } from '@/utils/deploymentUtils';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, config } = body;

        // Verify admin
        if (!isAdmin(email)) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Deploy contract
        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        
        const factory = new ethers.ContractFactory(
            VotingRegistrationArtifact.abi,
            VotingRegistrationArtifact.bytecode,
            wallet
        );

        // Updated to include submissionDuration parameter
        const contract = await factory.deploy(
            parseInt(config.registrationDuration),
            parseInt(config.submissionDuration),
            parseInt(config.votingDuration),
            config.candidates,
            config.allowedDomains
        );

        const receipt = await contract.deploymentTransaction()?.wait();
        const contractAddress = await contract.getAddress();

        // Update GitHub and trigger Vercel deployment with just the new address
        await updateGithubAndDeploy(contractAddress);

        return NextResponse.json({
            success: true,
            contractAddress,
            transactionHash: receipt?.hash
        });
    } catch (error) {
        console.error('Deployment error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Deployment failed' },
            { status: 500 }
        );
    }
}