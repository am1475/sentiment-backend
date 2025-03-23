require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const mongoose=require('mongoose');
const product=require('./db');
const app = express();
const { GoogleGenerativeAI } = require("@google/generative-ai");


app.use(cors());
app.use(bodyParser.json());

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const genAI = new GoogleGenerativeAI( process.env.GEMINI_API_KEY); // Loaded from .env


app.post('/analyze', async (req, res) => {
  const { productName, feedback,rating } = req.body;
  
  try {
    // 1. Save the product feedback into MongoDB
    await product.create({ name: productName, feedback,rating });
    console.log('Product feedback saved to DB');

    // 2. Send the feedback to the Hugging Face API for sentiment analysis
    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/cardiffnlp/twitter-roberta-base-sentiment",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: feedback }) // using "text" as the key per API requirements
      }
    );

    // Validate the API response is JSON
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) {
      const errorText = await response.text();
      console.error("Non-JSON response from Hugging Face:", errorText);
      return res.status(500).json({ error: "Unexpected response from Hugging Face", details: errorText });
    }

    const data = await response.json();

    // Validate that data is an array (flat structure)
    if (!Array.isArray(data)) {
      console.error("Unexpected JSON format:", data);
      return res.status(500).json({ error: "Unexpected JSON format from Hugging Face", data });
    }

    // Map Hugging Face labels to our sentiment names
    const labelMapping = {
      'LABEL_0': 'Negative',
      'LABEL_1': 'Neutral',
      'LABEL_2': 'Positive'
    };

    const sentimentScores = {
      positive: 0,
      neutral: 0,
      negative: 0
    };

    data.forEach((item) => {
      if (labelMapping[item.label] === 'Positive') sentimentScores.positive = item.score;
      if (labelMapping[item.label] === 'Neutral') sentimentScores.neutral = item.score;
      if (labelMapping[item.label] === 'Negative') sentimentScores.negative = item.score;
    });

    // Return the product name along with the sentiment scores
    res.json({ productName, sentimentScores });
  } catch (error) {
    console.error("Error in /analyze endpoint:", error);
    res.status(500).json({ error: "Failed to analyze sentiment", details: error.message });
  }
});


app.get('/api/reddit/posts', async (req, res) => {
  try {
    const redditUrl = 'https://www.reddit.com/r/news/top.json?limit=10';
    const response = await axios.get(redditUrl);

    const posts = response.data.data.children.map(item => {
      const data = item.data;
      // Use the thumbnail if it starts with "http", otherwise check preview images if available
      let image = '';
      if (data.thumbnail && data.thumbnail.startsWith('http')) {
        image = data.thumbnail;
      } else if (data.preview && data.preview.images && data.preview.images[0]) {
        image = data.preview.images[0].source.url;
      }
      
      return {
        title: data.title,
        subreddit: data.subreddit,
        url: `https://reddit.com${data.permalink}`,
        score: data.score,
        author: data.author,
        image // This will be an empty string if no image is available
      };
    });

    res.json(posts);
  } catch (error) {
    console.error('Error fetching Reddit posts:', error.message);
    res.status(500).json({ error: 'Error fetching Reddit posts', posts: [] });
  }
});

mongoose.connect("mongodb+srv://amartyapaul760:du8ZoJhDPDv3I7La@feedback.ieqzi.mongodb.net/?retryWrites=true&w=majority&appName=Feedback").then(()=>{
  console.log("mongodb connected")
}).catch(()=>{
  console.log("Error connecting to mongo db")
});

app.get('/products', async (req, res) => {
  try {
    const products = await product.find({});
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products", details: error.message });
  }
});

app.post("/gemini", async (req, res) => {
  console.log("Request method:", req.method);
  console.log("Request body:", req.body);

  try {
    // For the current project, we expect a prompt built from product data.
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    console.log("Generated prompt:", prompt);

    // Use the Gemini model (gemini-1.5-flash) via genAI interface
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    if (
      !result.response ||
      !result.response.candidates ||
      result.response.candidates.length === 0
    ) {
      console.error("No candidates found in response.");
      return res
        .status(500)
        .json({ error: "Invalid response from Gemini API." });
    }

    // Extract the generated suggestion from the candidate's parts
    let generatedText =
      result.response.candidates[0]?.content?.parts
        ?.map((part) => part.text)
        .join("\n") || "No suggestions generated";

    console.log("Extracted generated text:", generatedText);

    res.json({ suggestion: generatedText });
  } catch (error) {
    console.error("Error in /gemini route:", error);
    res.status(500).json({
      error: "An error occurred while fetching Gemini insights.",
    });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
