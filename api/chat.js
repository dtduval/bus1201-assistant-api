export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Simple test response
  res.status(200).json({ 
    content: [{ 
      text: "Test response - API is working!" 
    }] 
  });
}
