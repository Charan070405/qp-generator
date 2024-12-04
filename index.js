// server.js
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// API endpoint to handle image upload and question generation
app.post('/generate-questions', upload.single('image'), async (req, res) => {
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const base64Image = req.file.buffer.toString('base64');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Generate 8 questions based on the content of this image. Format the output as follows:
                    Section 1:
                    1. [Question 1]
                    2. [Question 2]
                    Section 2:
                    3. [Question 3]
                    4. [Question 4]
                    Section 3:
                    5. [Question 5]
                    6. [Question 6]
                    Section 4:
                    7. [Question 7]
                    8. [Question 8]
                    Each question should be on a new line, preceded by its number.`;

    try {
        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: req.file.mimetype, data: base64Image } }
                ]
            }]
        });

        const generatedQuestions = result.response.text();
        console.log(generatedQuestions);
        res.json({ questions: generatedQuestions });
    } catch (error) {
        console.error('Error generating questions:', error);
        res.status(500).json({ error: 'Failed to generate questions.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});