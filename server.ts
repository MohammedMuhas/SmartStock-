import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cron from "node-cron";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import admin from "firebase-admin";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { format, startOfDay, endOfDay } from "date-fns";
import fs from "fs";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import crypto from "crypto";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf-8"));

// Initialize Client SDK (for Vite/Frontend context if needed, though usually not on server)
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Initialize Admin SDK (for scheduled tasks to bypass security rules)
admin.initializeApp({
  projectId: firebaseConfig.projectId,
});
const adminDb = getAdminFirestore(firebaseConfig.firestoreDatabaseId);

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
      try {
        if (userId) {
          await adminDb.collection("users").doc(userId).update({
            subscriptionStatus: "premium",
            paymentId: razorpay_payment_id,
            upgradedAt: new Date().toISOString()
          });
          console.log(`User ${userId} upgraded to premium via verified payment ${razorpay_payment_id}`);
        }
        res.json({ success: true, message: "Payment verified successfully" });
      } catch (error) {
        console.error("Error updating user subscription after verification:", error);
        res.status(500).json({ error: "Payment verified but failed to update subscription" });
      }
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

  // Scheduled task at 9:40 PM daily
  cron.schedule("40 21 * * *", async () => {
    console.log("Running daily 9:40 PM WhatsApp notification task...");
    try {
      const today = new Date();
      const start = startOfDay(today).toISOString();
      const end = endOfDay(today).toISOString();

      // 1. Fetch all users using Admin SDK (bypasses rules)
      const usersSnapshot = await adminDb.collection("users").get();
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (!userData.whatsappNumber) continue;

        // 2. Fetch sales for this user today using Admin SDK
        const salesSnapshot = await adminDb.collection("sales")
          .where("ownerId", "==", userData.uid)
          .where("soldAt", ">=", start)
          .where("soldAt", "<=", end)
          .get();
        
        let totalAmount = 0;
        let totalItems = 0;
        const salesList: string[] = [];

        salesSnapshot.forEach((doc) => {
          const sale = doc.data();
          totalAmount += sale.totalAmount;
          totalItems += sale.quantitySold;
          salesList.push(`- ${sale.productName} x ${sale.quantitySold} = ₹${sale.totalAmount}`);
        });

        // 3. Fetch low stock items using Admin SDK
        const lowStockSnapshot = await adminDb.collection("products")
          .where("ownerId", "==", userData.uid)
          .where("quantity", "<", 5)
          .get();

        const lowStockList: string[] = [];
        lowStockSnapshot.forEach((doc) => {
          const product = doc.data();
          lowStockList.push(`- ${product.name} (${product.quantity} left)`);
        });

        if (salesSnapshot.empty && lowStockSnapshot.empty) {
          console.log(`No sales or low stock for user: ${userData.displayName} (${userData.email})`);
          continue;
        }

        // 4. Prepare summary message
        const dateStr = format(today, "dd-MMM-yyyy");
        let message = `*DAILY SHOP SUMMARY*\n\n` +
          `*Shop:* ${userData.displayName}\n` +
          `*Date:* ${dateStr}\n\n`;

        if (!salesSnapshot.empty) {
          message += `*TOTAL SALES: ₹${totalAmount}*\n` +
            `*Items Sold: ${totalItems}*\n\n` +
            `*Sales Details:*\n` +
            salesList.join("\n") + "\n\n";
        }

        if (!lowStockSnapshot.empty) {
          message += `*⚠️ LOW STOCK ALERTS:*\n` +
            lowStockList.join("\n") + "\n\n";
        }

        message += `Great job today!`;

        console.log(`----------------------------------------`);
        console.log(`AUTOMATIC NOTIFICATION PREPARED FOR: ${userData.whatsappNumber}`);
        console.log(`MESSAGE:\n${message}`);
        console.log(`----------------------------------------`);
      }
    } catch (error) {
      console.error("Error in scheduled task:", error);
    }
  }, {
    timezone: "Asia/Kolkata"
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
    console.log("Daily 9:40 PM WhatsApp notification task scheduled.");
  });
}

startServer();
