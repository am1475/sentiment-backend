require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

app.use(cors());
app.use(bodyParser.json());

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY; // Loaded from .env

app.post('/analyze', async (req, res) => {
  const { text } = req.body;
  try {
    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/cardiffnlp/twitter-roberta-base-sentiment",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: text })
      }
    );

    // Check if the response is OK and of type JSON
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) {
      const errorText = await response.text();
      console.error("Non-JSON response from Hugging Face:", errorText);
      return res.status(500).json({ error: "Unexpected response from Hugging Face", details: errorText });
    }

    const data = await response.json();

    if (!Array.isArray(data) || !data[0] || !Array.isArray(data[0])) {
      console.error("Unexpected JSON format:", data);
      return res.status(500).json({ error: "Unexpected JSON format from Hugging Face", data });
    }

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

    data[0].forEach((item) => {
      if (labelMapping[item.label] === 'Positive') sentimentScores.positive = item.score;
      if (labelMapping[item.label] === 'Neutral') sentimentScores.neutral = item.score;
      if (labelMapping[item.label] === 'Negative') sentimentScores.negative = item.score;
    });

    res.json(sentimentScores);
  } catch (error) {
    console.error("Error from Hugging Face:", error);
    res.status(500).json({ error: 'Failed to analyze sentiment', details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
