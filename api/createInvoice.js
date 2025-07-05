import admin from 'firebase-admin';

// --- Initialize Firebase Admin ---
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const firestore = admin.firestore();
// --- End of Firebase Init ---

export default async function handler(request, response) {
  // Set CORS headers for browser access
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle the browser's preflight request
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // Handle the main POST request
  if (request.method === 'POST') {
    const { appointmentId } = request.body;

    if (!appointmentId) {
      return response.status(400).json({ error: "appointmentId is required." });
    }

    try {
      // 1. Get the confirmed appointment data
      const appointmentRef = firestore.collection('confirmedAppointments').doc(appointmentId);
      const appointmentDoc = await appointmentRef.get();

      if (!appointmentDoc.exists) {
        return response.status(404).json({ error: "Confirmed appointment not found." });
      }
      const appointmentData = appointmentDoc.data();

      // 2. Create the new invoice data
      const newInvoice = {
        appointmentId: appointmentId,
        clientName: appointmentData.clientName || 'N/A',
        issueDate: admin.firestore.FieldValue.serverTimestamp(),
        dueDate: null, // You can add logic to set a due date, e.g., 30 days from now
        status: 'draft',
        lineItems: [
          {
            description: appointmentData.subject || 'Consultation',
            quantity: 1,
            price: 50.00 // You can pull this from a client's default rate later
          }
        ],
        total: 50.00
      };

      // 3. Save the new invoice to the 'invoices' collection
      const invoiceRef = await firestore.collection('invoices').add(newInvoice);

      // 4. Send back a success response
      return response.status(200).json({
        message: "Successfully created draft invoice.",
        invoiceId: invoiceRef.id,
        invoiceData: newInvoice
      });

    } catch (error) {
      console.error("Error creating invoice:", error);
      return response.status(500).json({ error: "Internal server error." });
    }
  } else {
    // Reject any method that isn't POST or OPTIONS
    return response.status(405).json({ error: "Method Not Allowed" });
  }
}
