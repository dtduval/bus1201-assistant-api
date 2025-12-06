// We use 'module.exports' instead of 'export default' for Vercel compatibility
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

    if (!process.env.GEMINI_API_KEY) {
      console.error('Error: GEMINI_API_KEY is missing');
      res.status(500).json({ error: 'Server misconfiguration: API key missing' });
      return;
    }

    // 1. Fetch Google Doc
    console.log('Fetching Google Doc...');
    const docResponse = await fetch('https://docs.google.com/document/d/e/2PACX-1vSQKFtFwES-1IK62rTPjN9UpZADz0hJ8u_7UjRtvsdLPKyEDNazKEDPSWTp9FGyWFw3ZhAx0q6mRrOX/pub');

    if (!docResponse.ok) {
      throw new Error(`Google Doc fetch failed: ${docResponse.status}`);
    }

    const rawHTML = await docResponse.text();

    // 2. Clean the HTML
    const courseContent = rawHTML
      .replace(/<\/tr>/g, '\n')
      .replace(/<\/td>/g, ' | ')
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
- If asking about dates (exams, first class), look for the "Class Schedule" or "Important Dates" section in the text.
- Be helpful, encouraging, and professional.
- Do not use emojis.`;

    // 4. Format Messages for Gemini API
    const geminiHistory = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // 5. Call Gemini 1.5 Flash via REST API
    console.log('Calling Gemini 1.5 Flash...');
    
const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;

    
    const response = await fetch(apiURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: geminiHistory,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 6. Adapt Response for your Frontend
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't find an answer.";

    res.status(200).json({
      content: [{ text: aiText }]
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
