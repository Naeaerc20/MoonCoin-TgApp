// index.js

const axios = require('axios');
const colors = require('colors');
const clear = require('console-clear');
const readline = require('readline-sync');

// Function to fetch allocation data for a given wallet address
async function fetchAllocation(address) {
    const url = `https://dashboard.mooncoin.co/api/eligible/proofMerkertree?address=${address}`;
    try {
        const response = await axios.get(url);
        if (response.status === 200) {
            const data = response.data;
            const allocationWei = data.entry.allocation;
            const allocation = allocationWei / 100000; // Convert wei to desired unit (e.g., 6138800000 / 100000 = 61388)
            return { address, allocation };
        } else {
            console.log(`${'⚠️  Warning:'.yellow} Received status code ${response.status} for address ${address}`.red);
            return { address, allocation: null };
        }
    } catch (error) {
        console.error(`${'❌ Error:'.red} Failed to fetch data for address ${address}. ${error.message}`);
        return { address, allocation: null };
    }
}

// Helper function to process wallets in batches
async function processBatches(wallets, batchSize = 5) {
    const results = [];
    for (let i = 0; i < wallets.length; i += batchSize) {
        const batch = wallets.slice(i, i + batchSize);
        // Process the current batch
        const batchResults = await Promise.all(batch.map(address => fetchAllocation(address)));
        results.push(...batchResults);
        // Optional: Add a small delay between batches to avoid hitting API rate limits
        // await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return results;
}

// Main function to handle user interaction
async function main() {
    clear(); // Clear the console at the start
    console.log(`${'🚀 SVM Wallet Allocator'.green.bold}\n`);

    let wallets = [];

    // Collect wallet addresses from the user
    while (true) {
        const address = readline.question('Enter your SVM wallet address (or type "done" to finish): '.cyan);
        if (address.trim().toLowerCase() === 'done') {
            break;
        }
        if (address.trim() !== '') {
            wallets.push(address.trim());
            console.log(`✅ Added wallet: ${address.green}\n`);
        } else {
            console.log('⚠️  Please enter a valid wallet address.\n'.yellow);
        }
    }

    if (wallets.length === 0) {
        console.log('No wallets were added. Exiting.'.yellow);
        return;
    }

    console.log(`\nFetching allocation data for ${wallets.length} wallet(s)... Please wait.\n`.yellow);

    // Process wallets in batches of 5
    const results = await processBatches(wallets, 5);

    // Calculate total allocation
    let totalAllocation = 0;

    // Display results
    console.log(`${'\n📊 Allocation Results'.green.bold}\n`);
    results.forEach((result, index) => {
        if (result.allocation !== null) {
            console.log(`${index + 1}. Address: ${result.address.green}`);
            console.log(`   📦 Allocation: ${result.allocation.toLocaleString().blue}\n`);
            totalAllocation += result.allocation;
        } else {
            console.log(`${index + 1}. Address: ${result.address.green}`);
            console.log(`   📦 Allocation: ${'Unavailable'.red}\n`);
        }
    });

    console.log(`🔢 Total Allocation: ${totalAllocation.toLocaleString()} MOON`.magenta);
}

// Run the main function
main();
