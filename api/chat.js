export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('=== API Request Started ===');
    const startTime = Date.now();
    
    const { messages } = req.body;
    console.log('Received messages:', messages?.length || 0);
    
    if (!messages) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({ error: 'API key not configured' });
      return;
    }

    // Fetch Google Doc with timeout
    console.log('Fetching Google Doc...');
    const docFetchStart = Date.now();
    
    const docResponse = await fetch('https://docs.google.com/document/d/e/2PACX-1vSQKFtFwES-1IK62rTPjN9UpZADz0hJ8u_7UjRtvsdLPKyEDNazKEDPSWTp9FGyWFw3ZhAx0q6mRrOX/pub', {
      timeout: 10000 // 10 second timeout
    });
    
    const docFetchTime = Date.now() - docFetchStart;
    console.log(`Google Doc fetch took ${docFetchTime}ms, status: ${docResponse.status}`);
    
    if (!docResponse.ok) {
      throw new Error(`Google Doc fetch failed: ${docResponse.status}`);
    }
    
    const courseContent = await docResponse.text();
    console.log(`Course content length: ${courseContent.length} characters`);
    
    // Create system prompt
    const systemPrompt = `You are an intelligent and professional course assistant for BUS 1201...`;
    
    const claudeMessages = [
      { role: "user", content: systemPrompt },
      ...messages
    ];
    
    // Call Claude API
    console.log('Calling Claude API...');
    const claudeStart = Date.now();
    
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

    const claudeTime = Date.now() - claudeStart;
    console.log(`Claude API took ${claudeTime}ms, status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const totalTime = Date.now() - startTime;
    console.log(`=== Total request time: ${totalTime}ms ===`);
    
    res.status(200).json(data);
    
  } catch (error) {
    console.error('=== API Error ===', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
