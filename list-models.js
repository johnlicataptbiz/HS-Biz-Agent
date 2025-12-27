import { GoogleGenerativeAI } from "@google/generative-ai";

async function list() {
  const apiKey = "AIzaSyDfofU97_DajcmqjpsF3gZnGKS-0gSRe-A";
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const models = await genAI.listModels();
    console.log(JSON.stringify(models, null, 2));
  } catch (e) {
    console.error(e);
  }
}

list();
