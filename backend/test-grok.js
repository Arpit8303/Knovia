import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

async function checkGrokModels() {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    console.error("No GROK_API_KEY in .env");
    return;
  }
  
  try {
    const res = await fetch('https://api.x.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data.data.map(m => m.id), null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}
checkGrokModels();
