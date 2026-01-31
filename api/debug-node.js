export const config = {
    runtime: 'nodejs',
};

export default function (request, response) {
    response.status(200).json({
        status: 'alive',
        runtime: 'nodejs',
        env: {
            NODE_ENV: process.env.NODE_ENV,
            HAS_DB: !!process.env.DATABASE_URL
        },
        message: 'Node.js runtime is working with pure JS.'
    });
}
