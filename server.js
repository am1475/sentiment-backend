require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.post('/analyze', async (req, res) => {
  const { text } = req.body;

  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment', 
      { inputs: text },
      { headers: { 'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}` } }
    );

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

    response.data[0].forEach((item) => {
      if (labelMapping[item.label] === 'Positive') sentimentScores.positive = item.score;
      if (labelMapping[item.label] === 'Neutral') sentimentScores.neutral = item.score;
      if (labelMapping[item.label] === 'Negative') sentimentScores.negative = item.score;
    });

    res.json(sentimentScores);
  } catch (error) {
    console.error('Error from Hugging Face:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to analyze sentiment' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
