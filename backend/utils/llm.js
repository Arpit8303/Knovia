export async function generateAnswer(llmProvider, prompt, cohereClient) {
  try {
    if (llmProvider === 'gemini') {
      const apiKey = process.env.GEMINI_KEY;
      if (!apiKey) throw new Error('GEMINI_KEY not set in .env');

      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
      const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      });

      for (const model of models) {
        const attempts = [
          {
            url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            headers: { 'Content-Type': 'application/json' },
            label: '?key='
          },
          {
            url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            label: 'x-goog-api-key'
          },
          {
            url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            label: 'Bearer'
          }
        ];

        for (const attempt of attempts) {
          try {
            const res = await fetch(attempt.url, {
              method: 'POST',
              headers: attempt.headers,
              body,
            });

            if (!res.ok) continue;

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              console.log(`✅ Gemini ${model} worked with ${attempt.label}`);
              return text;
            }
          } catch (err) {
            // skip
          }
        }
      }
      console.warn('⚠ All Gemini models failed, falling back to Cohere...');
      return await cohereChat(prompt, cohereClient);
    }



    if (llmProvider === 'nvidia') {
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) throw new Error('NVIDIA_API_KEY not set in .env');

      const models = [
        'meta/llama-3.1-70b-instruct',
        'meta/llama3-70b-instruct',
        'nvidia/nemotron-4-340b-instruct'
      ];

      for (const model of models) {
        try {
          const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 1024,
            })
          });

          if (!res.ok) {
            const errText = await res.text();
            console.warn(`Nvidia ${model} -> ${res.status}: ${errText.slice(0, 150)}`);
            continue;
          }

          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content;
          if (text) { 
            console.log(`✅ Nvidia ${model} worked`); 
            return text; 
          }
        } catch (err) {
          console.warn(`Nvidia ${model} error:`, err.message);
        }
      }
      throw new Error('All Nvidia model attempts failed');
    }

    if (llmProvider === 'cohere') {
      return await cohereChat(prompt, cohereClient);
    }

    throw new Error(`Unknown LLM provider: ${llmProvider}`);

  } catch (error) {
    console.error('LLM Error:', error.message);
    return `Error generating response from ${llmProvider}: ${error.message}`;
  }
}

async function cohereChat(prompt, client) {
  if (!client) throw new Error('Cohere client not initialized');

  const models = ['command-a-plus-05-2026', 'command-a-03-2025', 'command-nightly'];

  for (const model of models) {
    try {
      if (client.v2 && typeof client.v2.chat === 'function') {
        const resp = await client.v2.chat({
          model,
          messages: [{ role: 'user', content: prompt }]
        });
        const text = resp?.message?.content?.[0]?.text || resp?.text || resp?.message?.text;
        if (text) return text;
      }

      if (typeof client.chat === 'function') {
        const resp = await client.chat({ model, message: prompt });
        const text = resp?.text || resp?.message;
        if (text) return text;
      }
    } catch (err) {
      console.warn(`Cohere ${model} failed:`, err.message?.slice(0, 150) || err.message);
    }
  }
  throw new Error('All Cohere model attempts failed');
}
