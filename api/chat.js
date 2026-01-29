module.exports = async (req, res) => {
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
    const { messages } = req.body;

    if (!process.env.CLAUDE_API_KEY) {
      console.error('Error: CLAUDE_API_KEY is missing');
      res.status(500).json({ error: 'Server misconfiguration: API key missing' });
      return;
    }

    // 1. Fetch Google Doc
    console.log('Fetching Google Doc...');
    const docResponse = await fetch('https://docs.google.com/document/d/e/2PACX-1vSEnCocwxX2uI4fpMU2rW7c2vlTWMEU8jy54d7KcGGxt7LevvwReEpPLd42hzdyTTyiBUHNB1rupdTL/pub');

    if (!docResponse.ok) {
      throw new Error(`Google Doc fetch failed: ${docResponse.status}`);
    }

    const rawHTML = await docResponse.text();

    // 2. Clean the HTML (WITH MARKDOWN LINK CONVERSION)
    const courseContent = rawHTML
      .replace(/<\/tr>/g, '\n')
      .replace(/<\/td>/g, ' | ')
      // Converts <a href="...">Text</a> to Markdown [Text](URL)
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();

    // 3. Construct System Prompt
    const systemInstruction = `You are an intelligent and professional course assistant for BUS 1201 (Introduction to Business) at the University of Winnipeg, taught by Professor David Duval.

COURSE OUTLINE SOURCE DATA:
${courseContent}

INSTRUCTIONS:
- Answer based strictly on the source data above.
- If the source text includes a link (formatted like [Text](URL)), please include it in your answer using that exact format.
- If asking about dates (exams, first class), look for the "Class Schedule" or "Important Dates" section in the text.
- Be helpful, encouraging, and professional.
- Do not use emojis.`;

    // 4. Format Messages for Claude API
    const claudeMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    // 5. Call Claude Haiku
    console.log('Calling Claude Haiku...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        system: systemInstruction,
        messages: claudeMessages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 6. Adapt Response for your Frontend
    const aiText = data.content?.[0]?.text || "I'm sorry, I couldn't find an answer.";

    res.status(200).json({
      content: [{ text: aiText }]
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
