import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import crypto from "crypto";
import admin from 'firebase-admin';
import cron from 'node-cron';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized with service account');
} else if (process.env.FIREBASE_PROJECT_ID) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
  console.log('Firebase Admin initialized with application default credentials');
} else {
  console.warn('Firebase Admin not initialized: Missing credentials');
}

const db = admin.apps.length > 0 ? admin.firestore() : null;

// Scheduled Tasks
if (db) {
  // Daily Low Stock Summary (9:00 AM)
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily low stock check...');
    try {
      const usersSnapshot = await db.collection('users').get();
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (!userData.notificationsEnabled || !userData.email) continue;

        const productsSnapshot = await db.collection('products')
          .where('ownerId', '==', userDoc.id)
          .where('quantity', '<', 5)
          .get();

        if (productsSnapshot.empty) continue;

        const lowStockItems = productsSnapshot.docs.map(doc => doc.data().name);
        
        // Send email notification
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"SmartStock Alerts" <${process.env.EMAIL_USER}>`,
          to: userData.email,
          subject: 'Daily Low Stock Summary',
          html: `
            <h2>Low Stock Alert</h2>
            <p>The following items in your shop are running low (less than 5 items):</p>
            <ul>
              ${lowStockItems.map(item => `<li>${item}</li>`).join('')}
            </ul>
            <p>Please restock soon to avoid missing sales!</p>
          `
        });
      }
    } catch (error) {
      console.error('Error in daily low stock cron:', error);
    }
  });

  // Daily Sales Summary (8:00 PM)
  cron.schedule('0 20 * * *', async () => {
    console.log('Running daily sales summary...');
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const usersSnapshot = await db.collection('users').get();
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (!userData.notificationsEnabled || !userData.email) continue;

        const salesSnapshot = await db.collection('sales')
          .where('ownerId', '==', userDoc.id)
          .where('soldAt', '>=', today.toISOString())
          .get();

        if (salesSnapshot.empty) continue;

        const totalRevenue = salesSnapshot.docs.reduce((acc, doc) => acc + doc.data().totalAmount, 0);
        const totalSales = salesSnapshot.docs.length;

        // Send email notification
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"SmartStock Reports" <${process.env.EMAIL_USER}>`,
          to: userData.email,
          subject: 'Daily Sales Summary',
          html: `
            <h2>Daily Sales Performance</h2>
            <p>Great job today! Here is your summary for ${today.toLocaleDateString()}:</p>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 10px;">
              <p style="font-size: 24px; color: #059669; margin: 0;">Total Revenue: ₹${totalRevenue}</p>
              <p style="font-size: 18px; color: #065f46; margin: 5px 0 0 0;">Total Sales: ${totalSales}</p>
            </div>
            <p>Check your dashboard for detailed analytics.</p>
          `
        });
      }
    } catch (error) {
      console.error('Error in daily sales summary cron:', error);
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Razorpay Diagnostic Endpoint
  app.get("/api/razorpay/diagnostic", (req, res) => {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    const DUMMY_KEY_ID = "rzp_test_SUGn0AqySjAbLV";
    const DUMMY_SECRET = "1nR5Xq9fzeXBUehsmo7WrVi";

    const diagnose = (val: string | undefined, name: string, dummy: string) => {
      if (!val) return { status: "Missing", length: 0 };
      const trimmed = val.trim();
      const hasSecretsWord = trimmed.toLowerCase().includes("secrets");
      const isDummy = trimmed === dummy;
      
      return {
        status: "Present",
        length: trimmed.length,
        prefix: trimmed.substring(0, 8) + "...",
        suffix: "..." + trimmed.substring(Math.max(0, trimmed.length - 4)),
        hasWhitespace: val !== trimmed,
        hasSecretsWord,
        isDummy,
        recommendation: isDummy 
          ? `You are using a dummy ${name}. Please replace it with your real key from the Razorpay Dashboard.` 
          : (hasSecretsWord ? `Remove the word 'Secrets' from your ${name} value.` : "None")
      };
    };

    res.json({
      keyId: diagnose(keyId, "Key ID", DUMMY_KEY_ID),
      keySecret: diagnose(keySecret, "Key Secret", DUMMY_SECRET),
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });

  // Razorpay Order Creation
  app.post("/api/razorpay/create-order", async (req, res) => {
    const { amount, currency = "INR" } = req.body;

    const cleanKey = (val: string | undefined) => {
      if (!val) return undefined;
      let cleaned = val.trim();
      // Strip "Secrets" if it's at the beginning (common copy-paste error)
      if (cleaned.toLowerCase().startsWith("secrets")) {
        cleaned = cleaned.substring(7).trim();
      }
      return cleaned;
    };

    const keyId = cleanKey(process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID);
    const keySecret = cleanKey(process.env.RAZORPAY_KEY_SECRET);

    const DUMMY_KEY_ID = "rzp_test_SUGn0AqySjAbLV";
    const DUMMY_SECRET = "1nR5Xq9fzeXBUehsmo7WrVi";

    if (!keyId || !keySecret || keyId === DUMMY_KEY_ID || keySecret === DUMMY_SECRET || keyId === "rzp_test_dummykey") {
      console.log("Mock Razorpay order requested (Dummy or missing keys detected).");
      return res.json({
        id: `order_mock_${Date.now()}`,
        amount: amount,
        currency: currency,
        isMock: true
      });
    }

    // Diagnostic log (masked)
    console.log(`[Razorpay Diagnostic] Key ID: ${keyId?.substring(0, 8)}... Secret: ${keySecret?.substring(0, 4)}...`);

    try {
      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      const options = {
        amount: amount, // amount in the smallest currency unit
        currency: currency,
        receipt: `receipt_${Date.now()}`,
      };

      const order = await razorpay.orders.create(options);
      res.json(order);
    } catch (error: any) {
      console.error("Error creating Razorpay order:", error);
      
      // If authentication fails, fallback to mock order in preview environment
      if (error?.error?.description === 'Authentication failed') {
        console.log("Razorpay authentication failed. Falling back to mock order for preview.");
        return res.json({ 
          id: `order_mock_fallback_${Date.now()}`, 
          amount: amount,
          currency: currency,
          isMock: true,
          warning: "Authentication failed with your keys. Using mock mode instead."
        });
      }
      
      res.status(500).json({ error: "Failed to create order", details: error?.error?.description || "Unknown error" });
    }
  });

  // Razorpay Payment Verification
  app.post("/api/razorpay/verify-payment", async (req, res) => {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      userId 
    } = req.body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return res.status(500).json({ error: "Razorpay secret not configured on server" });
    }

    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature === razorpay_signature) {
      // Payment is verified
      console.log(`Payment verified successfully for user ${userId || 'unknown'}`);
      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      res.status(400).json({ error: "Invalid signature, payment verification failed" });
    }
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Support Request Email Endpoint
  app.post("/api/support", async (req, res) => {
    const { userId, userEmail, request, contactEmail, createdAt } = req.body;

    if (!request) {
      return res.status(400).json({ error: "Request content is required" });
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const supportEmail = process.env.SUPPORT_EMAIL || "mohamedmukasin@gmail.com";

    if (!emailUser || !emailPass) {
      console.warn("Email credentials not configured. Skipping email notification.");
      return res.json({ success: true, message: "Request saved (email not sent due to missing config)" });
    }

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      const mailOptions = {
        from: `"SmartStock Support" <${emailUser}>`,
        to: supportEmail,
        subject: `New Support Request from ${userEmail || "Anonymous"}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #059669;">New Support Request</h2>
            <p><strong>User ID:</strong> ${userId}</p>
            <p><strong>User Email:</strong> ${userEmail}</p>
            <p><strong>Contact Email:</strong> ${contactEmail || "Not provided"}</p>
            <p><strong>Date:</strong> ${createdAt}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p><strong>Request:</strong></p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #059669;">
              ${request.replace(/\n/g, "<br/>")}
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Support email sent to ${supportEmail}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending support email:", error);
      res.status(500).json({ error: "Failed to send email notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
