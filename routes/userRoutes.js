const express = require("express");
const nodemailer = require("nodemailer");
const cron = require("node-cron"); // Import the cron package
const router = express.Router();
const Records = require("../model/model");
const PaytmChecksum = require("paytmchecksum");
const PORT = process.env.PORT;
const MID = process.env.MID;
const MKEY = process.env.MKEY;
const URL = process.env.FRONTEND_URL;
const API = process.env.API;
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
            CALLBACK_URL: `${API}/api/payment/callback`,
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
        // console.error("Payment initiation failed:", error);
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
            return res.redirect(`${URL}/donation-failed`);
        }
        delete req.body.CHECKSUMHASH;

        const isValidChecksum = PaytmChecksum.verifySignature(
            req.body,
            MKEY,
            paytmChecksum
        );

        if (!isValidChecksum) {
            return res.redirect(`${URL}/donation-failed`);
        }

        const paytmResponse = req.body;
        const record = await Records.findOne({
            where: { orderId: paytmResponse.ORDERID },
        });
        if (paytmResponse.STATUS === "TXN_SUCCESS") {
            // Update paymentStatus in the database
            const updatedRecord = await Records.update(
                { paymentStatus: true },
                { where: { orderId: paytmResponse.ORDERID } }
            );

            if (updatedRecord[0] === 0) {
                return res.redirect(`${URL}/donation-failed`);
            }

            // console.log("Paytm response:", paytmResponse);
            // console.log(process.env.SMTP_USER);

            // Send success email to user
            const userMailOptions = {
                from: `"Amrita Chander Charity" <${process.env.SMTP_USER}>`,
                to: record.email,
                subject: "Thank You for Your Generous Donation",
                html: `<p>Dear ${record.fullName},</p>
                    <p>We are deeply grateful for your generous donation. Your support helps us continue our mission to make a meaningful impact.</p>
                    <p><strong>Transaction Details:</strong></p>
                    <p>Order ID: ${paytmResponse.ORDERID}</p>
                    <p>Amount: ₹${paytmResponse.TXNAMOUNT}</p>
                    <p>Thank you for being a part of our community.</p>
                    <p>Warm regards,</p>
                    <p>The Amrita Chander Charity Team</p>`,
            };

            // console.log("Preparing to send success email...");
            await transporter.sendMail(userMailOptions);
            // console.log("Success email sent.");

            // Send donation received email to trust mail
            const trustMailOptions = {
                from: `"Amrita Chander Charity" <${process.env.SMTP_USER}>`,
                to: "mail@amritachandercharity.org.in",
                subject: "Donation Received Notification",
                html: `<p>Dear Trust Team,</p>
                    <p>We have received a new donation.</p>
                    <p><strong>Donor Details:</strong></p>
                    <p>Name: ${record.fullName}</p>
                    <p>Email: ${record.email}</p>
                    <p>Order ID: ${paytmResponse.ORDERID}</p>
                    <p>Amount: ₹${paytmResponse.TXNAMOUNT}</p>
                    <p>Thank you for your continued support in managing these contributions.</p>
                    <p>Warm regards,</p>
                    <p>The Amrita Chander Charity Team</p>`,
            };

            await transporter.sendMail(trustMailOptions);

            return res.redirect(`${URL}/donation-successful`);
        } else {
            // Send failure email to the user
            const failureMailOptions = {
                from: `"Amrita Chander Charity" <${process.env.SMTP_USER}>`,
                to: record.email,
                subject: "Donation Attempt Unsuccessful",
                html: `<p>Dear ${record.fullName},</p>
                        <p>We regret to inform you that your recent donation attempt was unsuccessful. We truly appreciate your intention to support our cause.</p>
                        <p><strong>Transaction Details:</strong></p>
                        <p>Order ID: ${paytmResponse.ORDERID}</p>
                        <p>If you would like to try again, please visit our <a href="${URL}/donate">donation page</a>. If you have any questions or need assistance, feel free to contact us.</p>
                        <p>Thank you for your kindness and support.</p>
                        <p>Warm regards,</p>
                        <p>The Amrita Chander Charity Team</p>`,
            };

            await transporter.sendMail(failureMailOptions);

            return res.redirect(`${URL}/donation-failed`);
        }
    } catch (error) {
        return res.redirect(`${URL}/donation-failed`);
    }
});

module.exports = router;
