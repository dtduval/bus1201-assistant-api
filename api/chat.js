export default async function handler(req, res) {
  // Simple test response
  res.status(200).json({ 
    content: [{ 
      text: "Test response - API is working!" 
    }] 
  });
}
