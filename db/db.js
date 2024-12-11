const { Sequelize } = require("sequelize");
const { HOST, DBNAME, DBUSER, PASSWORD } = process.env;
const sequelize = new Sequelize(DBNAME, DBUSER, PASSWORD, {
  host: HOST,
  dialect: "mysql",
});

module.exports = sequelize;
