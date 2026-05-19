import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // AI Verification Logic
  app.post("/api/verify/ai-check", async (req, res) => {
    const { formData, sectionTitle } = req.body;
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ 
          role: 'user', 
          parts: [{ 
            text: `You are an elite cyber-security verification auditor. 
          Your task is to analyze user-submitted data for a specific verification section.
          Look for:
          1. Inconsistencies (e.g., father's name matches user's name).
          2. Nonsense or placeholder data.
          3. Suspicious patterns in contact numbers.
          4. Data that obviously doesn't belong in the field (e.g., numbers in a name field).
          
          CRITICAL: You MUST identify EXACTLY which fields are problematic. If multiple fields are provided, only flag the ones that are actually suspicious.
          
          Section: ${sectionTitle}
          
          Respond ONLY in JSON format with:
          {
            "isSuspicious": boolean,
            "riskReason": string (in Bengali, concise summary of issues),
            "severity": "low" | "medium" | "high",
            "flaggedFields": string[] (exact field keys from the input data that are problematic)
          }

          Evaluate this data: ${JSON.stringify(formData)}` 
          }] 
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isSuspicious: { type: Type.BOOLEAN },
              riskReason: { type: Type.STRING },
              severity: { type: Type.STRING },
              flaggedFields: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["isSuspicious", "riskReason", "severity", "flaggedFields"]
          }
        }
      });

      const resultStr = response.text || '{}';
      const result = JSON.parse(resultStr === '' ? '{}' : resultStr);
      res.json(result);
    } catch (err: any) {
      console.error("AI Check Error:", err);
      const isQuotaError = err?.message?.includes("429") || err?.status === 429;
      // Fail open to avoid blocking users if AI is down or quota hit
      res.json({ 
        isSuspicious: false, 
        riskReason: isQuotaError ? "AI Quota temporary limit reached." : "Internal technical error.", 
        severity: "low",
        flaggedFields: []
      });
    }
  });

  // Admin Verification Logic (Proxy or direct Firestore logic could go here)
  app.post("/api/verify/risk-score", async (req, res) => {
    // In a real app, this would use Gemini or a service to analyze the data
    const { userId } = req.body;
    res.json({ userId, score: Math.floor(Math.random() * 100), status: "analyzed" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VeraCore Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
