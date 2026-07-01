import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { CohereClient } from 'cohere-ai';
import Chunk from './models/Chunk.js';
import { chunkText } from './utils/chunking.js';
import { generateAnswer } from './utils/llm.js';

import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const cohere = new CohereClient({
  token: process.env.COHERE_KEY,
});

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are allowed!'), false);
    }
  }
});


app.get('/', (req, res) => {
  res.send('Knovia API is running');
});

// Upload route (Phase 2 & 3)
app.post('/api/upload', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
  }
  
  try {
    let extractedText = '';
    const filePath = req.file.path;
    
    if (req.file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      extractedText = data.text;
    } else if (req.file.mimetype === 'text/plain') {
      extractedText = fs.readFileSync(filePath, 'utf8');
    }
    
    // Clean text
    extractedText = extractedText.replace(/\s+/g, ' ').trim();
    
   
    const chunks = chunkText(extractedText, 500, 50);
    console.log(`Document chunked into ${chunks.length} chunks.`);
    
    // Phase 5: Embeddings & Phase 6: MongoDB Storage
    const docId = req.file.filename;
    let savedChunks = 0;

    if (chunks.length > 0) {
      
      const embedResponse = await cohere.embed({
        texts: chunks,
        model: 'embed-english-v3.0',
        inputType: 'search_document',
      });

      
      const embeddings = embedResponse.embeddings;

      // Save chunks to DB
      const chunkDocs = chunks.map((text, index) => ({
        text,
        embedding: embeddings[index],
        docId: docId,
        index: index
      }));

      await Chunk.insertMany(chunkDocs);
      savedChunks = chunkDocs.length;
      console.log(`Saved ${savedChunks} chunks to MongoDB.`);
    }

    res.json({ 
      success: true, 
      filePath: req.file.path, 
      fileName: req.file.originalname, 
      textPreview: extractedText.substring(0, 200),
      chunkCount: chunks.length,
      savedChunks: savedChunks
    });
  } catch (err) {
    console.error('Error in upload/embedding process:', err);
    res.status(500).json({ error: 'Failed to process document: ' + err.message });
  }
});

// Chat route (Phase 7 & 8)
app.post('/api/chat', async (req, res) => {
  const { question, llmProvider, docId } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    // Phase 7: Embed user question via Cohere
    const embedResponse = await cohere.embed({
      texts: [question],
      model: 'embed-english-v3.0',
      inputType: 'search_query',
    });

    const questionEmbedding = embedResponse.embeddings[0];
    console.log('Question embedded, vector length:', questionEmbedding.length);

    let topChunks = [];

    // Try MongoDB Atlas $vectorSearch first
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: questionEmbedding,
            numCandidates: 100,
            limit: 20,
          }
        },
        {
          $project: {
            _id: 0,
            text: 1,
            docId: 1,
            index: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ];

      let rawChunks = await Chunk.aggregate(pipeline);
      if (docId) {
        rawChunks = rawChunks.filter(c => c.docId === docId);
      }
      topChunks = rawChunks.slice(0, 3);
      console.log('Vector search returned', topChunks.length, 'chunks for this document');
    } catch (vectorErr) {
      console.warn('Vector search failed (index may not exist):', vectorErr.message);
    }

    
    if (!topChunks || topChunks.length === 0) {
      console.log('Falling back to manual cosine similarity...');
      
      // Get all chunks from DB (optionally filter by docId)
      const query = docId ? { docId } : {};
      const allChunks = await Chunk.find(query).lean();
      console.log('Total chunks in DB:', allChunks.length);

      if (allChunks.length > 0) {
        // Calculate cosine similarity manually
        const scored = allChunks.map(chunk => {
          const sim = cosineSimilarity(questionEmbedding, chunk.embedding);
          return { text: chunk.text, docId: chunk.docId, index: chunk.index, score: sim };
        });

        scored.sort((a, b) => b.score - a.score);
        topChunks = scored.slice(0, 3);
        console.log('Fallback found top chunks with scores:', topChunks.map(c => c.score.toFixed(3)));
      }
    }

    const contextText = topChunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
    console.log('Context length:', contextText.length, 'chars from', topChunks.length, 'chunks');

    const prompt = `You are a helpful assistant. Answer the user's question based ONLY on the following document excerpts. Reference the source using [1], [2], [3] numbers. If the context doesn't contain relevant information, say you couldn't find it in the document.

Context from uploaded document:
${contextText}

User Question: ${question}

Answer:`;

    const provider = (llmProvider || 'gemini').toString().toLowerCase().trim();
    console.log('Using LLM provider:', provider);
    const answer = await generateAnswer(provider, prompt, cohere);

    res.json({
      answer: answer,
      citations: topChunks
    });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to generate answer: ' + err.message });
  }
});

// Cosine similarity helper
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

// Database connection (Phase 6)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
