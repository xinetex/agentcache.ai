import 'dotenv/config';
import { cli } from './index';

cli(process.argv).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
