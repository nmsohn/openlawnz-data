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

if (!argv.cases) {
	criticalError("No cases passed in with --cases argument");
}

const cacheDir = "../.cache";

const casesToProcess = JSON.parse(decodeURIComponent(argv.cases));

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

const processPDFAndInsertIntoDatabase = (caseData, cb) => {
	let caseItem = {};
	let caseCitation = {};

	async.series(
		[
			cb => async.series(
				[
					// "failables" - if these functions fail, should be able to still insert
					// some metadata
					
					/**
					* Download PDF from MOJ
					*/
				   cbInner => {
					   const url = lib.getMOJURL(caseData.id);
					   const bucket_key = lib.slashToDash(caseData.id);
					   caseItem.bucket_key = bucket_key;
	   
					   if (fs.existsSync(`${cacheDir}/${bucket_key}`)) {
							cbInner();
						   	return;
					   }
	   
					   download(url)
						   .then(data => {
							   fs.writeFileSync(`${cacheDir}/${bucket_key}`, data);
							   cbInner();
						   })
						   .catch(err => {
								cbInner(err,"Error with pdf download url");
								return;
						   });
				   },
	   
				   /**
					* Convert PDF to text
					*/
					cbInner => {
					   	const pathtopdf = path.resolve("../xpdf/bin64/pdftotext");
					   	const pathtocache = path.resolve(cacheDir);
						let case_text = "Unprocessed";
						caseItem.case_text = case_text;
	   
						let convertError = null;
						
					   	try {
							const child = execSync(
								pathtopdf + " " + pathtocache + "/" + caseItem.bucket_key
							);
						}
						catch(err) {
							convertError = err;
							console.log("Error converting pdf to text, attempting to check if there is any salvagable text data.");
						}
					   //process.stdout.write(child.toString())
					   const noExtension = caseItem.bucket_key.replace(/\.pdf/g, "");

					   	try {
							case_text = fs.readFileSync(
								`${cacheDir}/${noExtension}.txt`,
								"utf8"
							);
						}
						catch(err) {
							console.log("Unable to salvage case text data")
							if (convertError) {
								cbInner(convertError,"Error with pdf conversion, unable to salvage any text data");
								return;
							}
							else {
								cbInner(err,"Error reading pdf conversion output");
								return;
							}
						}

						if (convertError) {
							console.log("Partial case text data salvaged");
							logging.recordAndLogError(
								logArray,
								"1.1 Pdf Processing",
								caseData.id,
								caseData.CaseName,
								"Error converting pdf, case text data was salvaged but may be incomplete or damaged.",
								convertError
							)
						}
					   caseItem.case_text = case_text;
					   cbInner();
				   },
	   
				   /**
					* Upload to S3
					*/
					cbInner => {
						s3.upload(
							{
								Key: caseItem.bucket_key,
								Body: fs.readFileSync(
									`${cacheDir}/${caseItem.bucket_key}`
								)
							},
							err => {
								if (err) {
									cbInner(err,"Error s3 upload");
									return;
								}
								cbInner()
							}
							
						);
				   }
				
				],
				(err, logMessage) => { //cbinner for failables
					if (err) {
						console.log("Error in download/parse pdf, casetext may be incomplete ");
						console.log("Case id: " + caseData.id);
						console.log(logMessage);
						console.log(err);
						logging.recordAndLogError(
							logArray,
							"1.1 Pdf Processing",
							caseData.id,
							caseData.CaseName,
							logMessage,
							err
						)
					}
					cb();
				}
			),
			cb => async.series( 
				[
					// final - these functions should run after the above, even if the earlier ones fail,
					// so that any salvagable data is still kept
					
				/**
				 * Delete cached item
				 */
				cbInner => {
					try {
						fs.unlinkSync(`${cacheDir}/${caseItem.bucket_key}`);
					}
					catch(err) {
						// ignore errors deleting this file, its possible it wasn't created
						// but either way should try delete in case it was. An error here is largely meaningless
					}

					try {
						fs.unlinkSync(`${cacheDir}/${caseItem.bucket_key.replace(".pdf",".txt")}`);
					}
					catch(err) {
						// separate try/catch in case one exists and the other doesn't, ensures both get deleted
					}
					
					cbInner();
				},

				/**
				 * Tidy object
				 */
				cbInner => {
					// process.stdout.write("tidying object\n");
					caseItem.pdf_fetch_date = new Date();
					caseItem.case_name = caseData.CaseName
						? lib.formatName(caseData.CaseName)
						: "Unknown case";
					// maybe rename table (and this) to be case_initial_citation ie the first citation found (if any)
					caseCitation.citation = caseData.CaseName
						? lib.getCitation(caseData.CaseName)
						: "";
					caseItem.case_date = caseData.JudgmentDate;

					cbInner();
				},

				/**
				 * Insert case into database
				 */
				cbInner => {
					connection.query("INSERT INTO cases SET ?", caseItem, function(
						err,
						result
					) {
						if (err) {
							cbInner(err,"Error inserting into cases table");
							return;
						}
						caseCitation.case_id = result.insertId;
						caseItem.id = result.insertId;
						cbInner();
					});
				},

				/**
				 * Insert case citation into database
				 */
				cbInner => {
					connection.query(
						"INSERT INTO case_citations SET ?",
						caseCitation,
						function(err, result) {
							if (err) {
								cbInner(err,"Error inserting into case_citations table");
								return;
							}
							cbInner();
						}
					);
				}
				
				
				],
				(err, logMessage) => { //cbinner
					if (err) {
						console.log("Fatal error in database insert for this case.");
						console.log("Case data will be missing from one or both of the case and case_citations tables");
						console.log("Case id: " + caseData.id);
						console.log(logMessage);
						console.log(err);
						logging.recordAndLogError(
							logArray,
							"1.1 Pdf Processing",
							caseData.id,
							caseData.CaseName,
							logMessage,
							err
						)
					}
					cb();
				}
			)
		],
		cb
	);
};

async.series(
	[
		/**
		 * Connect to DB
		 */
		cb => {
			connection.connect(err => {
				if (err) {
					cb(err);
					return;
				}
				cb();
			});
		},

		/**
		 * Process PDF's and insert into database
		 */
		cb => {
			var count = 1;

			async.parallel(
				casesToProcess.map(caseItem => {
					console.log("Processing case " + count)
					count++;
					return processPDFAndInsertIntoDatabase.bind(null, caseItem);
				}),
				(err, results) => {
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
		connection.end();
		if (err) {
			// Error checking moved to more specific spots, critical error disabled for now
		}
		console.log("Child process finished");
		log("[PROCESSOR_RESULT]");

		process.exit();
	}
);
