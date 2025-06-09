export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Fetch the Google Doc content
    console.log('Fetching course content...');
    const docResponse = await fetch('https://docs.google.com/document/d/e/2PACX-1vSQKFtFwES-1IK62rTPjN9UpZADz0hJ8u_7UjRtvsdLPKyEDNazKEDPSWTp9FGyWFw3ZhAx0q6mRrOX/pub');
    
    if (!docResponse.ok) {
      throw new Error('Failed to fetch course content');
    }
    
    const courseContent = await docResponse.text();
    
    // 2. Create system prompt with live course content
    const systemPrompt = `You are an intelligent and professional course assistant for BUS 1201 (Introduction to Business) at the University of Winnipeg, taught by Professor David Duval. You have access to the complete course outline and your role is to help students with any questions about the course.

COURSE OUTLINE CONTENT:
${courseContent}

INSTRUCTIONS:
- Be helpful, encouraging, and supportive like a caring teaching assistant
- Provide accurate information based on the course outline
- Remember our conversation context and build on previous exchanges
- Be conversational and personable, but professional
- DO NOT use emojis in responses - keep all responses clean and professional
- Use **bold** for important information like dates and policies
- Show empathy when students express concerns or stress about exams/grades
- Offer study tips and remind students that exam questions come from lectures
- Reference specific course policies when relevant
- Keep responses clear, professional, and academic in tone

You want to help students succeed in BUS 1201 and feel confident about the course.`;

    // 3. Prepare messages for Claude
    const { messages } = req.body;
    const claudeMessages = [
      { role: "user", content: systemPrompt },
      ...messages
    ];

    // 4. Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: claudeMessages
      })
    });

    if (!claudeResponse.ok) {
      throw new Error('Claude API request failed');
    }

    const data = await claudeResponse.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      details: error.message 
    });
  }
}
