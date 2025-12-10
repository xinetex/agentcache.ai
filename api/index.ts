import { handle } from 'hono/vercel';
import { app } from '../src/index.js';

export const config = {
    runtime: 'nodejs' // or 'edge' if using supported features
};

export default handle(app);
