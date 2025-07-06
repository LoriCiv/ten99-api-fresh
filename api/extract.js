import { GoogleGenerativeAI } from '@google/generative-ai';
import admin from 'firebase-admin';
import Busboy from 'busboy';

// --- Firebase Admin Initialization ---
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
}
const db = admin.firestore();
// --- End of Firebase Initialization ---

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

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
        const rawText = aiResponse.text();

        // This new regex finds the JSON block and extracts it, ignoring anything else.
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No valid JSON object found in AI response.");
        }
        const jsonString = jsonMatch[0];
        const jsonResponse = JSON.parse(jsonString);

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
