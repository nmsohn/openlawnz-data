const fs = require('fs-extra');
const path = require("path");
// const mysql = require("mysql2/promise");
const uuidv1 = require("uuid/v1"); //git repo no longer maintained

// Charset must be be utf8mb4 in db and connection
// Edit my.cnf on any new mysql sever https://mathiasbynens.be/notes/mysql-utf8mb4
// Returns a connection promise

const options = {

}
const pgPromise = require("pg-promise")(options);

module.exports = async (env, resumeSessionId) => {

	const rootDir = path.resolve(__dirname + "/../");
	const sessionId = resumeSessionId || uuidv1();
	const cacheDir = path.join(rootDir, ".cache", sessionId);
	const logDir = path.join(rootDir, ".logs", sessionId);

	if (!env) {
		throw new Error("Missing env");
	}

	require("dotenv").config({
		path: rootDir + "/.env." + env
	});

	// Ensure cache directory exists
	await fs.ensureDir(cacheDir);

	// Ensure log directory exists
	await fs.ensureDir(logDir);

	//TODO: connectionString
	let connection = {
		host: process.env.DB_HOST,
		port: "",
		user: process.env.DB_USER,
		password: process.env.DB_PASS,
		database: "cases",
		client_encoding = 'UTF8'
	}
	// await mysql.createConnection({
	// 	host: process.env.DB_HOST,
	// 	user: process.env.DB_USER,
	// 	password: process.env.DB_PASS,
	// 	database: "cases",
	// 	charset: "UTF8MB4_UNICODE_CI",
	// 	multipleStatements: true
	// });

	let pipeline_connection = {
		host: process.env.DB_HOST,
		user: process.env.DB_USER,
		password: process.env.DB_PASS,
		database: "pipeline_cases",
		port: "",
		client_encoding = 'UTF8'
	}
	
	// await mysql.createConnection({
	// 	host: process.env.DB_HOST,
	// 	user: process.env.DB_USER,
	// 	password: process.env.DB_PASS,
	// 	database: "pipeline_cases",
	// 	charset: "UTF8MB4_UNICODE_CI",
	// 	multipleStatements: true
	// });

	const db = await pgPromise(connection);
	const pipeline_db = await pgPromise(pipeline_connection);

	return {
		sessionId,
		cacheDir,
		logDir,
		db,
		pipeline_db
	}

};
