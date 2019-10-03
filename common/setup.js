const fs = require("fs-extra");
const path = require("path");
// const mysql = require("mysql2/promise");
const uuidv1 = require("uuid/v1"); //git repo no longer maintained

// Charset must be be utf8mb4 in db and connection
// Edit my.cnf on any new mysql sever https://mathiasbynens.be/notes/mysql-utf8mb4
// Returns a connection promise

const options = {};
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

	const conn = {
		host: process.env.DB_HOST,
		port: process.env.PORT,
		user: process.env.DB_USER,
		password: process.env.DB_PASS,
		database: "cases",
		client_encoding: "UTF8"
	};

	const p_conn = {
		host: process.env.DB_HOST,
		user: process.env.DB_USER,
		password: process.env.DB_PASS,
		database: "pipeline_cases",
		port: process.env.PORT,
		client_encoding: "UTF8"
	};

	let connection = await pgPromise(conn);
	let pipeline_connection = await pgPromise(p_conn);

	return {
		sessionId,
		cacheDir,
		logDir,
		connection,
		pipeline_connection
	};
};
