import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyDfofU97_DajcmqjpsF3gZnGKS-0gSRe-A";
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent("Hi");
    console.log("Success with gemini-2.0-flash-exp:", result.response.text());
  } catch (e) {
    console.error("Error with gemini-2.0-flash-exp:", e.message);
  }
}

listModels();
