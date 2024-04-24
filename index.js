const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs').promises;
require('dotenv').config();
const cors = require('cors');
global.fetch = require('node-fetch');
global.Headers = fetch.Headers;

const app = express();
app.use(cors());
app.use(express.json());

  
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const database = client.db("ai_final");
const collection = database.collection("tutorials");
const collection2 = database.collection("posts");
const collection3 = database.collection("discussions");


async function connectToDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (e) {
    console.error(e);
  }
}

connectToDB();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/retrieve', async (req, res) => {
    try {
      // Fetch the last document based on the _id in descending order.
      const lastDocument = await collection.find({}).sort({_id: -1}).limit(1).toArray();
  
      // Check if any document is found
      if (lastDocument.length === 0) {
        const { insertResult, insertResult2 } = renewContent();
        res.status(201).send({ message: "New document created with generated content", document: insertResult.ops[0] });
        res.status(201).send({ message: "New document created with generated content", document: insertResult2.ops[0] });

      } else {
        // Documents are found, return the last document
        console.log(lastDocument[0].date)
        const dateJS = new Date(lastDocument[0].date)
        const getMostRecentMonday = (date) => {
        const day = date.getDay();
        const difference = day === 0 ? 6 : day - 1;
        const mostRecentMonday = new Date(date);
        mostRecentMonday.setDate(date.getDate() - difference)
        mostRecentMonday.setHours(0, 0, 0, 0);;
        return mostRecentMonday;
        };

        const mostRecentMonday = getMostRecentMonday(new Date()); // Adjust this if you want to test against a specific date
        const nextMonday = new Date(mostRecentMonday);
        nextMonday.setDate(mostRecentMonday.getDate() + 7);
        if (dateJS >= mostRecentMonday && dateJS < nextMonday) {
          res.status(200).send({ message: "Last document found", document: lastDocument[0] });
        }
        else {
          const { insertResult, insertResult2 } = renewContent();
          res.status(201).send({ message: "New document created with generated content", document: insertResult.ops[0] });
          res.status(201).send({ message: "New document created with generated content", document: insertResult2.ops[0] });
        }
      }
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
});
  
  
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize the Google Generative AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Route to handle generative AI requests
app.post('/generate-content', async (req, res) => {
  try {
    const { prompt } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    res.json({ message: text });
  } catch (error) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: "Failed to generate content" });
  }
});

app.post('/post-message', async (req, res) => {
    const { promptId, prompt, content } = req.body;
    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        const message = { promptId, prompt, content, date: new Date() };
        const result = await collection2.insertOne(message);
        res.status(201).json(result.ops[0]);
    } catch (error) {
        console.error("Failed to post message:", error);
        res.status(500).json({ error: "Failed to post message" });
    }
});

// Assuming you have 'app' and 'collection' already set up

// Assuming 'collection2' is where messages are stored
app.get('/get-messages/:promptId', async (req, res) => {
    const { promptId } = req.params;
    try {
        const messages = await collection2.find({ promptId: promptId }).toArray();
        res.status(200).json(messages);
    } catch (error) {
        console.error("Failed to retrieve messages:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/get-discussions', async (req, res) => {
    try {
        const messages = await collection3.find({}).toArray(); // Fetch all messages
        res.status(200).json(messages);
    } catch (error) {
        console.error("Failed to retrieve messages:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/get-discussions/:promptId', async (req, res) => {
    const { promptId } = req.params; // Extracting promptId from the URL
    try {
        const discussions = await collection3.find({ promptId: promptId }).toArray();
        res.status(200).json(discussions);
        console.log(discussions)
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

async function renewContent(){
  // No documents are found, execute logic to create a new document
  const promptPath = './prompt.txt';
  const prompt = await fs.readFile(promptPath, 'utf8'); // Read the prompt from the file
  const prompt2Path = './prompt2.txt';
  const prompt2 = await fs.readFile(prompt2Path, 'utf8'); // Read the prompt from the file

  // Assuming you already have initialized and configured `genAI`
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const result = await model.generateContent(prompt);
  const text = await result.response.text();

  // Summarize the text using the same or a different model
  const summarizationPrompt = `Summarize the following text: ${text}`;
  const summaryResult = await model.generateContent(summarizationPrompt);
  const summaryText = await summaryResult.response.text();

  const htmlPrompt = `Please convert the following text into HTML format, using just <h1>, <h2>, <p>, and other HTML tags appropriately like this example ${prompt2}: ${text}`;
  const htmlResult = await model.generateContent(htmlPrompt);
  const htmlText = await htmlResult.response.text();

  const discussionPrompt = `Generate a single short discussion prompt about the societal/ethical/philosphical implications around the generative AI tool: ${text}. Just provide the question.` ;
  const discussionResult = await model.generateContent(discussionPrompt);
  const discussionText = await discussionResult.response.text();
  
  // Create a new document with the generated content and summary
  promptId = new ObjectId()
  const newDocument = {
    _id: promptId,
    summary: summaryText,
    content: htmlText,
    discussion: discussionText,
    date: new Date()
  };
  const newDoc2 = {
      _id: promptId,
      prompt: discussionText,
      data: new Date(),
      messages: 0
  }

  const insertResult = await collection.insertOne(newDocument);
  const insertResult2 = await collection3.insertOne(newDoc2);
  return {insertResult, insertResult2};
  // res.status(201).send({ message: "New document created with generated content", document: insertResult.ops[0] });
  // res.status(201).send({ message: "New document created with generated content", document: insertResult2.ops[0] });
}