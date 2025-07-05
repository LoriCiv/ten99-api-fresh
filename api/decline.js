import admin from 'firebase-admin';
import sgMail from '@sendgrid/mail'; // Import SendGrid Mail

// --- Initialize Services ---
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const firestore = admin.firestore();
sgMail.setApiKey(process.env.SENDGRID_API_KEY); // Set the SendGrid API key
// --- End of Init ---

export default async function handler(request, response) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method === 'POST') {
    const { appointmentId, clientEmail } = request.body; // We'll need the client's email to send the decline message

    if (!appointmentId || !clientEmail) {
      return response.status(400).json({ error: "appointmentId and clientEmail are required." });
    }

    try {
      // First, delete the pending appointment
      await firestore.collection('pendingAppointments').doc(appointmentId).delete();

      // Next, send the rejection email
      const msg = {
        to: clientEmail,
        from: 'noreply@ten99.app', // Use an email address from your verified domain
        subject: 'Regarding your recent request',
        text: 'Thank you for your request. Unfortunately, I am unavailable at the requested time and will have to decline. I will reach out shortly if my schedule opens up.',
        html: '<p>Thank you for your request. Unfortunately, I am unavailable at the requested time and will have to decline. I will reach out shortly if my schedule opens up.</p>',
      };
      await sgMail.send(msg);

      return response.status(200).json({ message: `Successfully declined appointment ${appointmentId} and sent notification.` });

    } catch (error) {
      console.error("Error declining appointment:", error);
      return response.status(500).json({ error: "Internal server error." });
    }
  } else {
    return response.status(405).json({ error: "Method Not Allowed" });
  }
}
