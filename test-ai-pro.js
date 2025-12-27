import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyDfofU97_DajcmqjpsF3gZnGKS-0gSRe-A";
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    // There is no easy 'listModels' in the simple SDK usually, but let's try gemini-pro
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("Hi");
    console.log("Success with gemini-pro:", result.response.text());
  } catch (e) {
    console.error("Error with gemini-pro:", e.message);
  }
}

listModels();
