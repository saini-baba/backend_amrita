const express = require("express");
const nodemailer = require("nodemailer");
const cron = require("node-cron"); // Import the cron package
const router = express.Router();
const Records = require("../model/model");
const PaytmChecksum = require("paytmchecksum");
const { v4: uuidv4 } = require("uuid");
const PORT = process.env.PORT;
const MID = process.env.MID;
const MKEY = process.env.MKEY;
const URL = process.env.FRONTEND_URL;
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Cron job to delete records with paymentStatus false every month on the 1st at midnight
cron.schedule("0 0 1 * *", async () => {
    try {
        console.log(
            "Running cron job: Deleting records with paymentStatus false..."
        );
        const deletedRecords = await Records.destroy({
            where: { paymentStatus: false },
        });

        if (deletedRecords > 0) {
            console.log(`${deletedRecords} records deleted.`);
        } else {
            console.log("No records found with paymentStatus false.");
        }
    } catch (error) {
        console.error("Error during cron job:", error);
    }
});

router.post("/send", async (req, res) => {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !phone || !message) {
        return res.status(400).json({ message: "All fields are required" });
    }
    try {
        const mailOptions = {
            from: `"Contact Form" <${process.env.SMTP_USER}>`,
            to: "mail@amritachandercharity.org.in",
            subject: "New Contact Form Submission",
            html: `<p><strong>Name:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Phone:</strong> ${phone}</p>
             <p><strong>Message:</strong> ${message}</p>`,
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Email sent successfully!" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Failed to send email", error });
    }
});

router.post("/payment/initiate", async (req, res) => {
    try {
        const values = req.body;

        const orderId = `20${Date.now()}${Math.floor(Math.random() * 1000)}`;

        let paytmParams = {
            MID: MID,
            WEBSITE: "DEFAULT",
            CHANNEL_ID: "WEB",
            INDUSTRY_TYPE_ID: "ECommerce",
            ORDER_ID: orderId,
            CUST_ID: values.email,
            TXN_AMOUNT: values.amount || "100.00",
            CALLBACK_URL: `http://localhost:${PORT}/api/payment/callback`,
            EMAIL: values.email,
            MOBILE_NO: values.mobile,
        };
        const newRecord = await Records.create({
            fullName: values.fullName,
            email: values.email,
            phoneNo: values.mobile,
            address: values.address,
            dob: values.dateOfBirth,
            pincode: values.pincode,
            pan: values.pan || "Not Provided",
            city: values.city,
            state: values.state,
            country: values.country,
            paymentStatus: false, // Default to false until payment succeeds
            amount: values.amount || 100.0, // Use provided amount or default to 100.00
            orderId: orderId, // Use generated unique order ID
        });
        // console.log("New record created:", newRecord);
        // Generate checksum using PaytmChecksum
        const checksum = await PaytmChecksum.generateSignature(
            paytmParams,
            MKEY
        );
        paytmParams.CHECKSUMHASH = checksum;

        res.json({
            payment_url: `https://securegw.paytm.in/theia/processTransaction?${new URLSearchParams(
                paytmParams
            ).toString()}`,
        });
    } catch (error) {
        console.error("Payment initiation failed:", error);
        res.status(500).json({
            message: "Payment initiation failed",
            error: error.message,
        });
    }
});

router.post("/payment/callback", async (req, res) => {
    try {
        const paytmChecksum = req.body.CHECKSUMHASH;
        if (!paytmChecksum) {
            return res.status(400).json({ error: "CHECKSUMHASH is missing" });
        }
        delete req.body.CHECKSUMHASH;

        const isValidChecksum = PaytmChecksum.verifySignature(
            req.body,
            MKEY,
            paytmChecksum
        );

        if (!isValidChecksum) {
            return res.status(400).json({ error: "Checksum mismatch" });
        }

        if (req.body.STATUS === "TXN_SUCCESS") {
            const paytmResponse = req.body;

            // Update paymentStatus in the database
            const updatedRecord = await Records.update(
                { paymentStatus: true }, // Set paymentStatus to true
                { where: { orderId: paytmResponse.ORDERID } } // Match the orderId
            );

            if (updatedRecord[0] === 0) {
                // No records were updated, meaning the orderId was not found
                // console.error("Order ID not found:", paytmResponse.ORDERID);
                return res.status(404).json({
                    message: "Order not found",
                    orderId: paytmResponse.ORDERID,
                });
            }

            console.log(
                "Payment status updated for order:",
                paytmResponse.ORDERID
            );

            return res.redirect(`${URL}/donate`);
        }

        return res.redirect(`${URL}/donate`);
    } catch (error) {
        console.error("Callback processing failed:", error);
        res.status(500).json({ message: "Callback processing failed" });
    }
});

module.exports = router;
