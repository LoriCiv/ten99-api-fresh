import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Busboy from 'busboy';

// Decode the Base64 service account key and parse it as JSON
const encodedKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const decodedKey = Buffer.from(encodedKey, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(decodedKey);

// Initialize Firebase Admin if not already initialized
if (!initializeApp) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}
const db = getFirestore();

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Helper function to parse multipart form data
const parseMultipartForm = (req) => {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        const fields = {};

        busboy.on('field', (fieldname, val) => {
            fields[fieldname] = val;
        });

        busboy.on('finish', () => {
            resolve(fields);
        });

        busboy.on('error', err => {
            reject(err);
        });
        
        if (req.body) {
            busboy.end(req.body);
        } else {
            req.pipe(busboy);
        }
    });
};


export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        const formData = await parseMultipartForm(request);
        const emailText = formData.text; 

        if (!emailText) {
            console.error("Email text is missing from the form data.", formData);
            return response.status(400).json({ error: 'Email text not found in request.' });
        }

        const prompt = `Extract the appointment details from this email body as a JSON object with keys "description" and "startTime". startTime should be a valid ISO 8601 string. Email Body: "${emailText}"`;
        const result = await model.generateContent(prompt);
        const aiResponse = await result.response;
        const jsonResponse = JSON.parse(aiResponse.text());

        const docRef = await db.collection('pendingAppointments').add({
            description: jsonResponse.description,
            startTime: jsonResponse.startTime,
            status: 'pending',
            createdAt: new Date().toISOString()
        });

        console.log("Successfully processed email and saved to Firestore with ID:", docRef.id);
        response.status(200).json({ success: true, documentId: docRef.id });
    } catch (error) {
        console.error("Error processing request:", error);
        response.status(500).json({ error: 'Failed to process email.', details: error.message });
    }
}
