// src/utils/deploymentUtils.ts

import { Octokit } from '@octokit/rest';

export async function updateGithubAndDeploy(contractAddress: string) {
  try {
    // Initialize GitHub client
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    // Update constant file with new address
    await updateContractAddress(octokit, contractAddress);

    // Trigger Vercel deployment
    await triggerVercelDeployment();

    return { success: true };
  } catch (error) {
    console.error('Deployment update failed:', error);
    throw error;
  }
}

async function updateContractAddress(octokit: Octokit, address: string) {
  const owner = process.env.GITHUB_OWNER!;
  const repo = process.env.GITHUB_REPO!;
  const path = 'src/constant/index.ts';

  try {
    // Get current file content
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if ('content' in fileData) {
      // Decode content from base64
      const content = Buffer.from(fileData.content, 'base64').toString();

      // Update only the contract address
      const updatedContent = content.replace(
        /export const VOTING_CONTRACT_ADDRESS = ".*";/,
        `export const VOTING_CONTRACT_ADDRESS = "${address}";`
      );

      // Encode back to base64
      const encodedContent = Buffer.from(updatedContent).toString('base64');

      // Commit changes
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: 'Update contract address',
        content: encodedContent,
        sha: fileData.sha,
      });
    }
  } catch (error) {
    console.error('Error updating contract address:', error);
    throw error;
  }
}

async function triggerVercelDeployment() {
  try {
    const response = await fetch(process.env.VERCEL_DEPLOY_HOOK_URL!, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to trigger Vercel deployment');
    }

    return await response.json();
  } catch (error) {
    console.error('Error triggering Vercel deployment:', error);
    throw error;
  }
}