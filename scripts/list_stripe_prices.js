import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function listPrices() {
    console.log('Listing all prices for key:', process.env.STRIPE_SECRET_KEY.slice(0, 10) + '...');

    const prices = await stripe.prices.list({
        limit: 100,
        active: true,
        expand: ['data.product']
    });

    console.log('\nFound ' + prices.data.length + ' prices:');

    prices.data.forEach(p => {
        const product = p.product;
        const amount = (p.unit_amount / 100).toFixed(2);
        console.log(`- ${product.name} (${amount} ${p.currency.toUpperCase()}) / ${p.recurring?.interval}`);
        console.log(`  Price ID: ${p.id}`);
        console.log(`  Product ID: ${product.id}`);
        console.log('');
    });
}

listPrices();
