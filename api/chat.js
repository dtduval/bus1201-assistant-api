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

    // CHECK FOR OPENAI KEY INSTEAD OF ANTHROPIC
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'OpenAI API key not configured' });
      return;
    }

    // Fetch Google Doc with HTML parsing (Exactly as before)
    console.log('Fetching Google Doc...');
    const docFetchStart = Date.now();

    const docResponse = await fetch('https://docs.google.com/document/d/12pjYrJib1xP3cIihJRNhhzcX2qvSkofUl-5vYpfp7T4/edit?usp=sharing');

    const docFetchTime = Date.now() - docFetchStart;
    console.log(`Google Doc fetch took ${docFetchTime}ms, status: ${docResponse.status}`);

    if (!docResponse.ok) {
      throw new Error(`Google Doc fetch failed: ${docResponse.status}`);
    }

    const rawHTML = await docResponse.text();

    // Simple HTML tag removal - convert HTML to text
    const courseContent = rawHTML
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')  // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')    // Remove styles  
      .replace(/<[^>]*>/g, ' ')                          // Remove HTML tags
      .replace(/\s+/g, ' ')                              // Clean whitespace
      .replace(/&nbsp;/g, ' ')                           // Decode entities
      .trim();

    console.log(`Course content length: ${courseContent.length} characters`);
    console.log('COURSE CONTENT SEARCH:', courseContent.includes('4BC57') ? 'FOUND 4BC57' : 'NOT FOUND - still old content');
    
    // Create system prompt
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

    // Prepare messages for OpenAI
    // We use the proper "system" role for the instructions
    const openAIMessages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...messages
    ];

    // Call OpenAI API
    console.log('Calling OpenAI API...');
    const aiStart = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openAIMessages,
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    const aiTime = Date.now() - aiStart;
    console.log(`OpenAI API took ${aiTime}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // === CRITICAL STEP ===
    // We must reformat OpenAI's response to match what your existing website expects.
    // Your website expects: data.content[0].text (Claude style)
    // OpenAI gives: data.choices[0].message.content (OpenAI style)
    
    const adaptedResponse = {
      content: [
        {
          text: data.choices[0].message.content
        }
      ]
    };

    const totalTime = Date.now() - startTime;
    console.log(`=== Total request time: ${totalTime}ms ===`);

    // Send the adapted response back to your website
    res.status(200).json(adaptedResponse);

  } catch (error) {
    console.error('=== API Error ===', error.message);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
