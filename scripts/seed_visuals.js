/**
 * Seed Script for QChannel Visuals
 * Usage: node scripts/seed_visuals.js
 */

// For this implementation, I'll generate SQL insert statements that the user can run, 
// OR I'll write a standalone script that connects using pg.

import { query } from '../lib/db.js';

const visuals = [
    // Cyberpunk / Crypto Cities
    {
        url: 'https://images.unsplash.com/photo-1550948329-84724a735c02?w=1920&q=80',
        type: 'background',
        title: 'Neon Tokyo',
        artist: 'Unsplash'
    },
    {
        url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1920&q=80',
        type: 'background',
        title: 'Cyber Monkey',
        artist: 'Unsplash'
    },
    {
        url: 'https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=1920&q=80',
        type: 'background',
        title: 'Pixel Punk',
        artist: 'Unsplash'
    },
    // Abstract Data / Finance
    {
        url: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=1920&q=80',
        type: 'background',
        title: 'Blockchain Nodes',
        artist: 'Unsplash'
    },
    {
        url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&q=80',
        type: 'background',
        title: 'Ethereum Glow',
        artist: 'Unsplash'
    },
    // Nature / Calm (for Ambient Mode)
    {
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80',
        type: 'screensaver',
        title: 'Liquid Oil',
        artist: 'Unsplash'
    },
    {
        url: 'https://images.unsplash.com/photo-1614850523060-8da1d56e37ad?w=1920&q=80',
        type: 'screensaver',
        title: 'Neon Fog',
        artist: 'Unsplash'
    }
];

async function seed() {
    console.log('🌱 Seeding QChannel Visuals...');

    try {
        // Clear existing (optional, maybe we want to append? let's invalid/clear for dev)
        // await query('DELETE FROM qchannel_visuals');

        for (const v of visuals) {
            console.log(`Inserting: ${v.title}`);
            await query(`
                INSERT INTO qchannel_visuals (url, type, title, artist)
                VALUES ($1, $2, $3, $4)
            `, [v.url, v.type, v.title, v.artist]);
        }

        console.log('✅ Seeding complete!');
    } catch (err) {
        console.error('Error seeding:', err);
    }
    // No need to close pool explicitly as the query helper manages it or it persists
}

seed();
