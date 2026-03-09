import 'dotenv/config';
import { cli } from './index.js';

cli(process.argv).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
