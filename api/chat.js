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
    console.log('Fetching course content from Google Doc...');
    const docResponse = await fetch('https://docs.google.com/document/d/e/2PACX-1vSQKFtFwES-1IK62rTPjN9UpZADz0hJ8u_7UjRtvsdLPKyEDNazKEDPSWTp9FGyWFw3ZhAx0q6mRrOX/pub');
    
    if (!docResponse.ok) {
      console.error('Failed to fetch Google Doc:', docResponse.status);
      throw new Error('Failed to fetch course content from Google Doc');
    }
    
    const courseContent = await docResponse.text();
    console.log('Successfully fetched course content, length:', courseContent.length);
    
    // Create system prompt with live course content
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
- Offer study tips: focus on lectures (not just textbook), use examples from class
- Remind students that exam questions come from lectures, not textbook
- Be encouraging about the course structure (only 2 exams, no assignments to juggle)
- Reference specific course policies when relevant (like health policy, grading, etc.)
- When asked about exams, provide complete, specific information from the course outline
- Keep responses clear, professional, and academic in tone

RESPONSE STYLE:
- Be warm, encouraging, and supportive but maintain professionalism
- Keep responses clear and well-organized with good formatting
- Use bullet points and bold text for emphasis, but no emojis
- Ask follow-up questions when helpful
- If students seem stressed, acknowledge it and provide reassurance professionally
- Always respond as Professor Duval's knowledgeable, caring teaching assistant
- Maintain an academic, professional tone throughout

You want to help students succeed in BUS 1201 and feel confident about the course.`;

    // Prepare messages for Claude with the system prompt first
    const claudeMessages = [
      {
        role: "user",
        content: systemPrompt
      },
      ...messages
    ];
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: claudeMessages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(500).json({ 
        error: `Claude API error: ${response.status}`,
        details: errorText 
      });
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
