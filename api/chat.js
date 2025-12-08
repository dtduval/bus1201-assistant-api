// Import the Rate Limit tools
const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis'); // Changed from @vercel/kv to generic Redis

// 1. Setup the Database Connection
// We check for EITHER the Vercel KV keys OR the generic REDIS_URL
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.REDIS_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.REDIS_TOKEN || 'example_token',
});

// 2. Create Rate Limiter
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
});

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    // === RATE LIMIT CHECK ===
    const ip = req.headers['x-forwarded-for'] || '127.0.0.1';
    
    // We wrap this in a try/catch so if Redis fails, the chat DOES NOT break.
    // It just allows the user through (Fail Open).
    try {
        const { success } = await ratelimit.limit(`ratelimit_${ip}`);
        if (!success) {
            console.warn(`Rate limit exceeded for IP: ${ip}`);
            res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
            return;
        }
    } catch (redisError) {
        console.warn("Redis Error (Rate Limiting Skipped):", redisError.message);
    }
    // ===========================

    const { messages } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'Server misconfiguration: API key missing' });
      return;
    }

    // Fetch Google Doc
    const docResponse = await fetch('https://docs.google.com/document/d/e/2PACX-1vSQKFtFwES-1IK62rTPjN9UpZADz0hJ8u_7UjRtvsdLPKyEDNazKEDPSWTp9FGyWFw3ZhAx0q6mRrOX/pub');
    if (!docResponse.ok) throw new Error(`Google Doc fetch failed: ${docResponse.status}`);
    const rawHTML = await docResponse.text();

    const courseContent = rawHTML
      .replace(/<\/tr>/g, '\n').replace(/<\/td>/g, ' | ')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim();

    const systemInstruction = `You are an intelligent and professional course assistant for BUS 1201 (Introduction to Business) at the University of Winnipeg, taught by Professor David Duval. 

COURSE OUTLINE SOURCE DATA:
${courseContent}

INSTRUCTIONS:
- Answer based strictly on the source data above.
- If the source text includes a link (formatted like [Text](URL)), please include it in your answer using that exact format.
- If asking about dates (exams, first class), look for the "Class Schedule" or "Important Dates" section in the text.
- Be helpful, encouraging, and professional.
- Do not use emojis.`;

    const geminiHistory = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await fetch(apiURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: geminiHistory,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1000 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't find an answer.";

    res.status(200).json({ content: [{ text: aiText }] });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
