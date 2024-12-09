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
app.use(express.static('public'));

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Determine number of questions based on marks
function determineQuestionCount(marks) {
    switch(marks) {
        case 25: return 2;
        case 50: return 3;
        case 100: return 5;

        default: return 2;
    }
}

// API endpoint to handle image upload and question generation
app.post('/generate-questions', upload.single('image'), async (req, res) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    const marks = parseInt(req.body.maxMarks) || 20;
    const numQuestions = determineQuestionCount(marks);

    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const base64Image = req.file.buffer.toString('base64');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Generate ${numQuestions} comprehensive questions, each with two main parts (a and b).
                   For each part (a) and part (b), provide two sub-questions.
                   Each sub-question should be clear, focused, and relevant to the image content.
                   Format the output as:
                   Q1:
                   a1) First sub-question of part a
                   a2) Second sub-question of part a
                   b1) First sub-question of part b
                   b2) Second sub-question of part b`;

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
        const questionBlocks = generatedQuestions.split('Q').filter(q => q.trim() !== '');

        // Distribute marks evenly
        const marksPerSubQuestion = marks / (numQuestions * 4);

        const questions = [];

        questionBlocks.forEach((block, questionIndex) => {
            const subQuestions = block.split('\n').filter(q => q.trim() !== '');
            
            const questionParts = {
                a: subQuestions.filter(q => q.startsWith('a')),
                b: subQuestions.filter(q => q.startsWith('b'))
            };

            const questionPart = {
                a: questionParts.a.map((subQ, subIndex) => ({
                    questionNumber: questionIndex + 1,
                    questionPart: 'a',
                    subPart: subIndex + 1,
                    questionText: subQ.replace(/^a\d*\)\s*/, '').trim(),
                    marks: marksPerSubQuestion,
                    bloomLevel: 'L3',
                    bloomLevelDescription: 'Apply',
                    course: 'CO3'
                })),
                b: questionParts.b.map((subQ, subIndex) => ({
                    questionNumber: questionIndex + 1,
                    questionPart: 'b',
                    subPart: subIndex + 1,
                    questionText: subQ.replace(/^b\d*\)\s*/, '').trim(),
                    marks: marksPerSubQuestion,
                    bloomLevel: 'L4',
                    bloomLevelDescription: 'Analyze',
                    course: 'CO3'
                }))
            };

            questions.push(...questionPart.a, ...questionPart.b);
        });

        res.json({
            questions: questions,
            totalQuestions: numQuestions,
            marksRequested: marks,
            totalMarks: marks
        });
    } catch (error) {
        console.error('Error generating questions:', error);
        res.status(500).json({ error: 'Failed to generate questions.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
