const { DataTypes } = require("sequelize");
const sequelize = require("../db/db"); // Import the database connection

// Define the Form model with all the fields
const Form = sequelize.define("Form", {
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dob: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true, // Validate email format
    },
  },
  mobile: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  pincode: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  pan: {
    type: DataTypes.STRING,
    allowNull: true,
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
});

// Sync the model with the database
async function syncDatabase() {
  try {
    await sequelize.sync({ force: false }); // Set force: true to recreate the table (for testing)
    console.log("Database synced!");
  } catch (error) {
    console.error("Error syncing database:", error);
  }
}

// Export model and sync function
module.exports = {
  Form,
  syncDatabase,
};
