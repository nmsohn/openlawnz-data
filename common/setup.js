const mysql = require("mysql2/promise");
const path = require("path");

// Charset must be be utf8mb4 in db and connection
// Edit my.cnf on any new mysql sever https://mathiasbynens.be/notes/mysql-utf8mb4
// Returns a connection promise
module.exports = env => {
	if (!env) {
		throw new Error("Missing env");
	}
	require("dotenv").config({
		path: path.resolve(__dirname + "/../") + "/.env." + env
	});
	return mysql.createConnection({
		host: process.env.DB_HOST,
		user: process.env.DB_USER,
		password: process.env.DB_PASS,
		database: "cases",
		charset: "UTF8MB4_UNICODE_CI",
		multipleStatements: true
	});
};
