const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();
const PaytmChecksum = require("paytmchecksum");
const { v4: uuidv4 } = require("uuid");
const PORT = process.env.PORT;
const MID = process.env.MID;
const MKEY = process.env.MKEY;
const { Form } = require("../model/model");
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
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

    const paytmParams = {
      MID: MID,
      WEBSITE: "DEFAULT",
      CHANNEL_ID: "WEB",
      INDUSTRY_TYPE_ID: "ECommerce",
      ORDER_ID: uuidv4(),
      CUST_ID: values.email,
      TXN_AMOUNT: values.amount || "100.00",
      CALLBACK_URL: `http://localhost:${PORT}/api/payment/callback`,
      EMAIL: values.email,
      MOBILE_NO: values.mobile,
      NAME: values.fullName,
      ADDRESS: values.address,
      DOB: values.dateOfBirth,
      PINCODE: values.pincode,
      PAN: values.pan || "Not Provided",
      CITY: values.city,
      STATE: values.state,
      COUNTRY: values.country,
    };
    console.log(paytmParams);

    // Generate checksum using PaytmChecksum
    const checksum = await PaytmChecksum.generateSignature(paytmParams, MKEY);
    paytmParams.CHECKSUMHASH = checksum;

    // Respond with the Paytm payment URL
    console.log(
      `https://securegw-stage.paytm.in/theia/processTransaction?${new URLSearchParams(
        paytmParams
      ).toString()}`
    );

    res.json({
      payment_url: `https://securegw.paytm.in/theia/processTransaction?${new URLSearchParams(
        paytmParams
      ).toString()}`,
    });
  } catch (error) {
    console.error("Payment initiation failed:", error);
    res
      .status(500)
      .json({ message: "Payment initiation failed", error: error.message });
  }
});

router.post("/payment/callback", async (req, res) => {
  try {
     console.log("Callback triggered with data:", req.body);
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

      await savePaymentDetails({
        orderId: paytmResponse.ORDERID,
        amount: paytmResponse.TXNAMOUNT,
        status: paytmResponse.STATUS,
        name: paytmResponse.NAME,
        address: paytmResponse.ADDRESS,
        dob: paytmResponse.DOB,
        email: paytmResponse.CUSTID,
        mobile: paytmResponse.MOBILE_NO,
        pincode: paytmResponse.PINCODE,
        pan: paytmResponse.PAN,
        city: paytmResponse.CITY,
        state: paytmResponse.STATE,
        country: paytmResponse.COUNTRY,
      });

      return res.redirect(`/donate?status=success&orderId=${req.body.ORDERID}`);
    }

    return res.redirect(`/donate?status=failure&reason=${req.body.RESPMSG}`);
  } catch (error) {
    console.error("Callback processing failed:", error);
    res.status(500).json({ message: "Callback processing failed" });
  }
});


async function savePaymentDetails(paytmResponse) {
  try {
    const form = await Form.create({
      orderId: paytmResponse.ORDERID,
      amount: paytmResponse.TXNAMOUNT,
      status: paytmResponse.STATUS,
      name: paytmResponse.NAME,
      address: paytmResponse.ADDRESS,
      dob: paytmResponse.DOB,
      email: paytmResponse.CUSTID,
      mobile: paytmResponse.MOBILE_NO,
      pincode: paytmResponse.PINCODE,
      pan: paytmResponse.PAN,
      city: paytmResponse.CITY,
      state: paytmResponse.STATE,
      country: paytmResponse.COUNTRY,
    });
    console.log("Payment details saved:", form);
  } catch (error) {
    console.error("Error saving payment details:", error);
  }
}

module.exports = router;
