export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { messages } = req.body;
    
    if (!messages) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({ error: 'API key not configured' });
      return;
    }

    // Fetch the Google Doc content
    const docResponse = await fetch('https://docs.google.com/document/d/e/2PACX-1vSQKFtFwES-1IK62rTPjN9UpZADz0hJ8u_7UjRtvsdLPKyEDNazKEDPSWTp9FGyWFw3ZhAx0q6mRrOX/pub');
    
    if (!docResponse.ok) {
      throw new Error('Failed to fetch course content from Google Doc');
    }
    
    const courseContent = await docResponse.text();
    
    // Create system prompt with live course content
    const systemPrompt = `You are an intelligent and professional course assistant for BUS 1201 (Introduction to Business) at the University of Winnipeg, taught by Professor David Duval. You have access to the complete course outline and your role is to help students with any questions about the course.

COURSE OUTLINE CONTENT:
${courseContent}

INSTRUCTIONS:
- Be helpful, encouraging, and supportive like a caring teaching assistant
- Provide accurate information based on the course outline
- Remember our conversation context and build on previous exchanges
- Be conversational and personable, but professional
- DO NOT use emojis in responses - keep all responses clean an
