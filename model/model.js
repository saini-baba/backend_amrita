const { DataTypes } = require("sequelize");
const database = require("../db/db");
const { v4: uuidv4 } = require("uuid");
const Records = database.db.define(
    "records",
    {
        fullName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: false,
            validate: {
                isEmail: true, // Ensures the email is in a valid format
            },
        },
        orderId: {
            type: DataTypes.UUID, // UUID type for unique identifier
            defaultValue: uuidv4, // Automatically generates UUID when a record is created
            unique: true, // Ensures orderId is unique
        },
        phoneNo: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        dob: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        pincode: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        pan: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        city: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        state: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        country: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        paymentStatus: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2), // Supports monetary values with up to 2 decimal places
            allowNull: false,
        },
    },
    {
        timestamps: true,
    }
);

Records.sync();

module.exports = Records;
