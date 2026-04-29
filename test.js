export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      method: 'GET',
      message: 'Hello from GET',
      time: new Date().toISOString()
    });
  }

  if (req.method === 'POST') {
    return res.status(200).json({
      method: 'POST',
      message: 'Hello from POST',
      data: req.body
    });
  }

  return res.status(405).json({
    error: 'Method Not Allowed'
  });
}
