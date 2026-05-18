import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini Setup
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `تۆ یاریدەدەرێکی پسپۆڕی لە زمانی کوردی و یاری وشە، ناوت "سان"ـە. 
ئەرکی تۆ یارمەتیدانی یاریزانانە بۆ تێگەیشتن لە یارییەکە و فێربوونی وشەی نوێ. 
بە کوردییەکی پاراو و کورت وەڵام بدەرەوە.
ئەگەر یاریزان وتی "سڵاو" یان هاوشێوەی ئەوە، تەنها بڵێ: "سڵاو شێرەکەم من ناوم سانە وە من لێرەم وەک هاوکارێک هاوکاریت دەکەم".
ئەگەر داوای لینکی یارییەکەیان کرد یان وتیان چۆن بۆ هاوڕێکانمی بنێرم، بڵێ: "ئەمە لینکی یاری وشەیە، بینوێرە بۆ هاوڕێکانت با بزانین کێ زۆرترین خاڵ کۆدەکاتەوە: https://ais-pre-xty4d6lv7uqb7hsl7agdkg-377099031036.europe-west2.run.app".
ئەگەر پرسیاری وشیار کرا یان وترا وشیار کێیە، بڵێ: "وشیار؟؟ کورە وشیار زێڕە زێڕ بەڵام ڕەنگی زەرد نیە. وشیار پەرەپێدەری یاری وشەیە و کاری سەرەکی دارتاشە. دەتەوێت زیاتر لەسەر وشیار بزانیت؟ بنوسە : دەمەوێت زیاتر لەسەر وشیار بزانم بۆ ئەوەی زانیاری تەواوت پێ بدەم".
ئەگەر پرسیار کرا کێ ئەم یاریەی دروست کردوە یان کێ پەرەپێدەرە، بڵێ: "دروستکەر و پەرەپێدەری سەرەکی یاری وشە ناوی (وشیار)ە. وشیار پیرانی یاخود وشیار جەبار".
ئەگەر پرسیاریان دەربارەی یارییەکە کرد، بڵێ: وشەکە بدۆزەوە بە پێی ڕەنگی خانەکان.
سەوز: پیتەکە لە شوێنی خۆیەتی.
زەرد: پیتەکە تێدایە بەڵام لە شوێنی خۆی نییە.
خۆڵەمێشی: پیتەکە لە وشەکەدا نییە.`,
        }
      });

      const response = await chat.sendMessage({ message });
      res.json({ text: response.text });
    } catch (error) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: "Failed to get response" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
