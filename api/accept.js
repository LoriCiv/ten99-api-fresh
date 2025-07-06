import admin from 'firebase-admin';

// This is the most robust way to initialize Firebase Admin in Vercel
if (!admin.apps.length) {
  try {
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountString) {
      throw new Error('Firebase service account key is not set.');
    }

    // Vercel sometimes passes the JSON as an object and sometimes as a string. This handles both.
    const serviceAccount = typeof serviceAccountString === 'string' 
      ? JSON.parse(serviceAccountString) 
      : serviceAccountString;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error.message);
  }
}

const db = admin.firestore();

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  try {
    const { id } = JSON.parse(request.body);

    if (!id) {
      return response.status(400).json({ error: 'Appointment ID is required.' });
    }

    // We now update the document in the 'appointments' collection
    const appointmentRef = db.collection('appointments').doc(id);
    await appointmentRef.update({ status: 'confirmed' });

    console.log(`Appointment ${id} status updated to confirmed.`);
    return response.status(200).json({ success: true, id: id });

  } catch (error) {
    console.error("Error accepting appointment:", error);
    return response.status(500).json({ error: 'Failed to accept appointment.', details: error.message });
  }
}
