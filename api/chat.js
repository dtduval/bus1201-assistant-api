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

   // Fetch Google Doc with HTML parsing
   console.log('Fetching Google Doc...');
   const docFetchStart = Date.now();
   
   const docResponse = await fetch('https://docs.google.com/document/d/e/2PACX-1vSQKFtFwES-1IK62rTPjN9UpZADz0hJ8u_7UjRtvsdLPKyEDNazKEDPSWTp9FGyWFw3ZhAx0q6mRrOX/pub');
   
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
   console.log('Also checking lowercase:', courseContent.includes('4bc57') ? 'FOUND 4bc57' : 'NOT FOUND');
   console.log('First 500 chars of cleaned text:', courseContent.substring(0, 500));
   
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
- Offer study tips and remind students that exam questions come from lectures
- Reference specific course policies when relevant
- Keep responses clear, professional, and academic in tone

You want to help students succeed in BUS 1201 and feel confident about the course.`;

   // Prepare messages for Claude with the system prompt first
   const claudeMessages = [
     {
       role: "user",
       content: systemPrompt
     },
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
       model: 'claude-sonnet-4-20250514',
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
