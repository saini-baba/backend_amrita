const { Sequelize } = require("sequelize");
const { HOST, DBNAME, DBUSER, PASSWORD } = process.env;
console.log(HOST);

const db = new Sequelize(DBNAME, DBUSER, PASSWORD, {
    host: HOST,
    port: 3306,
    dialect: "mysql",
    logging: false,
});
async function connection() {
    await db
        .authenticate()
        .then(() => {
            console.log("Database connected successfully.");
        })
        .catch((err) => {
            console.error("Unable to connect to the database:", err);
        });
}
connection();
module.exports = { db };
