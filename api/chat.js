// In your Vercel API function
export default async function handler(req, res) {
  try {
    // Fetch the Google Doc content
    const docResponse = await fetch('https://docs.google.com/document/d/e/2PACX-1vSQKFtFwES-1IK62rTPjN9UpZADz0hJ8u_7UjRtvsdLPKyEDNazKEDPSWTp9FGyWFw3ZhAx0q6mRrOX/pub');
    const courseContent = await docResponse.text();
    
    // Add the course content to your system prompt
    const systemPrompt = `You are a course assistant for BUS 1201...
    
COURSE OUTLINE CONTENT:
${courseContent}

INSTRUCTIONS:...`;
    
    // Send to Claude with the live content
    // ... rest of your Claude API call
  } catch (error) {
    // Handle errors
  }
}
