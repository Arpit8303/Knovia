/**
 * API Test Script — tests Cohere, Gemini, Grok, OpenRouter individually
 * Run: node test-apis.js
 */
import dotenv from 'dotenv';
dotenv.config();

const GREEN = '\x1b[32m✅\x1b[0m';
const RED   = '\x1b[31m❌\x1b[0m';
const BLUE  = '\x1b[34mℹ\x1b[0m';

async function testCohere() {
  console.log('\n' + BLUE + ' Testing Cohere (Embeddings + Chat)...');
  try {
    const { CohereClient } = await import('cohere-ai');
    const cohere = new CohereClient({ token: process.env.COHERE_KEY });

    // Test embeddings
    const embedResp = await cohere.embed({
      texts: ['Hello world'],
      model: 'embed-english-v3.0',
      inputType: 'search_query',
    });
    const dims = embedResp.embeddings[0].length;
    console.log(GREEN + ` Cohere Embeddings OK — vector dims: ${dims}`);

    // Test chat
    const chatResp = await cohere.chat({ model: 'command-r-plus', message: 'Say "OK" only.' });
    const text = chatResp?.text || chatResp?.message || JSON.stringify(chatResp).slice(0, 80);
    console.log(GREEN + ` Cohere Chat OK — response: ${text.trim().slice(0, 60)}`);
  } catch (err) {
    console.log(RED + ` Cohere FAILED: ${err.message}`);
  }
}

async function testGemini() {
  console.log('\n' + BLUE + ' Testing Gemini...');
  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) { console.log(RED + ' GEMINI_KEY missing'); return; }

  // Try the REST generateContent endpoint (v1beta) with API key as query param
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Say OK only.' }] }] }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.log(RED + ` Gemini ${model} failed: ${res.status} — ${err.slice(0, 120)}`);
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data).slice(0, 60);
      console.log(GREEN + ` Gemini ${model} OK — response: ${text.trim().slice(0, 60)}`);
      return model; // return working model
    } catch (err) {
      console.log(RED + ` Gemini ${model} error: ${err.message}`);
    }
  }
}

async function testGrok() {
  console.log('\n' + BLUE + ' Testing Grok (X.AI)...');
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) { console.log(RED + ' GROK_API_KEY missing'); return; }

  const models = ['grok-3', 'grok-2', 'grok-beta', 'grok-1'];
  for (const model of models) {
    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say OK only.' }],
          max_tokens: 10,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.log(RED + ` Grok ${model} failed: ${res.status} — ${err.slice(0, 120)}`);
        continue;
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || JSON.stringify(data).slice(0, 60);
      console.log(GREEN + ` Grok ${model} OK — response: ${text.trim().slice(0, 60)}`);
      return model;
    } catch (err) {
      console.log(RED + ` Grok ${model} error: ${err.message}`);
    }
  }
}

async function testOpenRouter() {
  console.log('\n' + BLUE + ' Testing OpenRouter...');
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) { console.log(RED + ' OPENROUTER_API_KEY missing'); return; }

  // Use a free model on OpenRouter
  const models = [
    'mistralai/mistral-7b-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'google/gemma-2-9b-it:free',
  ];
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Knovia',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say OK only.' }],
          max_tokens: 10,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.log(RED + ` OpenRouter ${model} failed: ${res.status} — ${err.slice(0, 120)}`);
        continue;
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || JSON.stringify(data).slice(0, 60);
      console.log(GREEN + ` OpenRouter ${model} OK — response: ${text.trim().slice(0, 60)}`);
      return model;
    } catch (err) {
      console.log(RED + ` OpenRouter ${model} error: ${err.message}`);
    }
  }
}

async function testMongo() {
  console.log('\n' + BLUE + ' Testing MongoDB Atlas connection...');
  try {
    const mongoose = (await import('mongoose')).default;
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log(GREEN + ' MongoDB Atlas connected OK');
    await mongoose.disconnect();
  } catch (err) {
    console.log(RED + ` MongoDB FAILED: ${err.message}`);
  }
}

(async () => {
  console.log('\n========================================');
  console.log('   Knovia — API Health Check');
  console.log('========================================');

  const geminiModel = await testGemini();
  await testGrok();
  await testOpenRouter();
  await testCohere();
  await testMongo();

  console.log('\n========================================');
  if (geminiModel) console.log(BLUE + ` Working Gemini model: ${geminiModel}`);
  console.log('========================================\n');
})();
