export const config = {
  runtime: 'nodejs'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  return res.status(200).json({
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    bodyType: typeof req.body,
    received: 'success'
  });
}
