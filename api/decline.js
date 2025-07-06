import admin from 'firebase-admin';

// Safely initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountString) {
      throw new Error('Firebase service account key is not set.');
    }

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

    const appointmentRef = db.collection('pendingAppointments').doc(id);
    // The only change is here: setting the status to 'declined'
    await appointmentRef.update({ status: 'declined' });

    console.log(`Appointment ${id} status updated to declined.`);
    return response.status(200).json({ success: true, id: id });

  } catch (error) {
    console.error("Error declining appointment:", error);
    return response.status(500).json({ error: 'Failed to decline appointment.', details: error.message });
  }
}
