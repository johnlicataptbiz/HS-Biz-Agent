import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyDfofU97_DajcmqjpsF3gZnGKS-0gSRe-A";
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });
    const result = await model.generateContent("Hi");
    console.log("Success with gemini-1.5-flash (v1):", result.response.text());
  } catch (e) {
    console.error("Error with gemini-1.5-flash (v1):", e.message);
  }
}

listModels();
