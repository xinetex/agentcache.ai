export const config = {
    runtime: 'edge',
};

export default function (request) {
    return new Response(
        JSON.stringify({
            status: 'alive',
            runtime: 'edge',
            message: 'Edge runtime is working.'
        }),
        {
            status: 200,
            headers: {
                'content-type': 'application/json',
            },
        }
    );
}
