import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyDfofU97_DajcmqjpsF3gZnGKS-0gSRe-A";
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await models.generateContent("Hi");
    console.log("Success with gemini-1.5-flash:", result.response.text());
  } catch (e) {
    console.error("Error with gemini-1.5-flash:", e.message);
  }

  try {
    const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await models.generateContent("Hi");
    console.log("Success with gemini-1.5-flash-latest:", result.response.text());
  } catch (e) {
    console.error("Error with gemini-1.5-flash-latest:", e.message);
  }
}

listModels();
