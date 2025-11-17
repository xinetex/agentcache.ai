#!/usr/bin/env node

/**
 * Daily Data Update Script
 * 
 * Fetches fresh data from CoinGecko and GitHub APIs
 * Run this via cron job or GitHub Actions daily at midnight UTC
 * 
 * Usage: node scripts/update-daily-data.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../public/data');
const CRYPTO_FILE = path.join(DATA_DIR, 'crypto-cached.json');
const GITHUB_FILE = path.join(DATA_DIR, 'github-cached.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function fetchCryptoData() {
  console.log('🪙 Fetching crypto market data from CoinGecko...');
  
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1';
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Save to file
    fs.writeFileSync(CRYPTO_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ Saved ${data.length} crypto coins to ${CRYPTO_FILE}`);
    console.log(`   File size: ${(fs.statSync(CRYPTO_FILE).size / 1024).toFixed(2)}KB`);
    
    return data;
  } catch (error) {
    console.error('❌ Error fetching crypto data:', error.message);
    throw error;
  }
}

async function fetchGitHubData() {
  console.log('⭐ Fetching GitHub trending repos...');
  
  const url = 'https://api.github.com/search/repositories?q=stars:>1000&sort=stars&order=desc&per_page=100';
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AgentCache-Daily-Update'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Save to file
    fs.writeFileSync(GITHUB_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ Saved ${data.items.length} GitHub repos to ${GITHUB_FILE}`);
    console.log(`   File size: ${(fs.statSync(GITHUB_FILE).size / 1024).toFixed(2)}KB`);
    
    return data;
  } catch (error) {
    console.error('❌ Error fetching GitHub data:', error.message);
    throw error;
  }
}

async function updateMetadata() {
  const metadata = {
    lastUpdated: new Date().toISOString(),
    cryptoDataSize: fs.statSync(CRYPTO_FILE).size,
    githubDataSize: fs.statSync(GITHUB_FILE).size,
    totalSize: fs.statSync(CRYPTO_FILE).size + fs.statSync(GITHUB_FILE).size,
    nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
  
  const metadataFile = path.join(DATA_DIR, 'metadata.json');
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  console.log('\n📊 Update Summary:');
  console.log(`   Last Updated: ${metadata.lastUpdated}`);
  console.log(`   Total Data: ${(metadata.totalSize / 1024).toFixed(2)}KB`);
  console.log(`   Next Update: ${metadata.nextUpdate}`);
}

async function main() {
  console.log('\n🚀 Starting daily data update...\n');
  
  try {
    await fetchCryptoData();
    console.log('');
    await fetchGitHubData();
    console.log('');
    await updateMetadata();
    
    console.log('\n✨ Daily data update complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Update failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchCryptoData, fetchGitHubData, updateMetadata };
