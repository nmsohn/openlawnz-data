"use strict";

const AWS = require("aws-sdk");
const async = require("async");
const download = require("download");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const argv = require("yargs").argv;
require("dotenv").config({ path: __dirname + "/../.env" });

const lib = require("../lib/functions.js");
const connection = require("../lib/db.js");

const criticalError = msg => {
	process.stderr.write(
		typeof msg !== "string" ? JSON.stringify(msg, null, 4) : msg
	);
	process.exit();
};

const log = msg => {
	process.stdout.write(
		typeof msg !== "string" ? JSON.stringify(msg, null, 4) : msg
	);
};

// Set up array for error logging. If specified by parent process, will use an export path to save summary
const logging = require("../controller/loggingFunctions");
const logArray = [];
if (argv.exportPath) {
	logArray.exportPath = argv.exportPath;
}

const cacheDir = "../.cache";

const creds = new AWS.SharedIniFileCredentials({
	profile: process.env.AWS_PROFILE
});

if (!creds.accessKeyId) {
	criticalError("Invalid AWS credentials");
}

AWS.config.credentials = creds;

const s3 = new AWS.S3({
	params: { Bucket: process.env.AWS_S3_BUCKET }
});

fs.existsSync(cacheDir) || fs.mkdirSync(cacheDir);

const run = (connection, cb) => {
	fs.existsSync(cacheDir) || fs.mkdirSync(cacheDir);

	connection.query(
		"select cases.pdf_id, cases.id, case_pdf.pdf_id, case_pdf.bucket_key from cases INNER JOIN case_pdf ON cases.pdf_id = case_pdf.pdf_id",
		function(err, results, fields) {
			if (err) {
				cb(err);
				return;
			}

			async.series(
				[
					cb => {
						async.parallelLimit(
							results.map(result => {
								return function(cb) {
									s3.getObject(
										{
											Key: result.bucket_key
										},
										(err, data) => {
											if (err) {
												cb(err);

												return;
											}
											fs.writeFileSync(
												`${cacheDir}/${
													result.bucket_key
												}`,
												data.Body
											);
											//console.log(data)
											cb();
										}
									);
								};
							}),
							10,
							err => {
								if (err) {
									cb(err);
									return;
								}
								cb();
							}
						);
					},
					cb => {
						async.parallelLimit(
							results.map(result => {
								return function(cb) {
									const pathtopdf = path.resolve(
										"../xpdf/bin64/pdftotext"
									);
                                    const pathtocache = path.resolve(cacheDir);
                                    let case_text;
									case_text = "Unprocessed";

									let convertError = null;
									
									try {
										const child = execSync(
											pathtopdf +
												" " +
												pathtocache +
												"/" +
												result.bucket_key
										);
									} catch (err) {
										convertError = err;
										console.log(
											"Error converting pdf to text, attempting to check if there is any salvagable text data."
										);
									}
									//process.stdout.write(child.toString())
									const noExtension = result.bucket_key.replace(
										/\.pdf/g,
										""
									);

									try {
										case_text = fs.readFileSync(
											`${cacheDir}/${noExtension}.txt`,
											"utf8"
										);
									} catch (err) {
										console.log(
											"Unable to salvage case text data"
										);
										if (convertError) {
											cb(
												convertError,
												"Error with pdf conversion, unable to salvage any text data"
											);
											return;
										} else {
											cb(
												err,
												"Error reading pdf conversion output"
											);
											return;
										}
									}

									if (convertError) {
										console.log(
											"Partial case text data salvaged"
										);
										cb(convertError);
									} else {
                                        
										connection.query(
											"UPDATE cases SET case_text=? WHERE cases.id=?", [case_text, result.id],
											function(err, results, fields) {
												if (err) {
													cb(err);
													return;
												}

												cb();
											}
										);
									}
								};
							}),
							10,
							err => {
								if (err) {
									cb(err);
									return;
								}
								cb();
							}
						);
					}
				],
				err => {
					if (err) {
						cb(err);
						return;
                    }
                    console.log("Done update")
					cb();
				}
			);
		}
	);
};

if (require.main === module) {
	const connection = require("../lib/db");
	connection.connect(err => {
		if (err) {
			console.log("Error connecting");
			return;
		}
		run(connection, err => {
			connection.end();
			if (err) {
				console.log(err);
				return;
			}
			console.log("Done");
		});
	});
} else {
	module.exports = run;
}
