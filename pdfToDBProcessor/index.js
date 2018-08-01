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
	let inBucket = false;
	let isValid = false;
	let pdfId = null;
	let existingCaseId = null;
	let ignoreCase = false;
	const bucket_key = lib.slashToDash(caseData.id);

	async.series(
		[
			cb => async.series(
				[
					// "failables" - if these functions fail, should be able to still insert
					// some metadata
					
					/**
					 * Check if in bucket and if valid
					 */
					cbInner => {
						connection.query("SELECT pdf_id FROM case_pdf WHERE bucket_key = ?", bucket_key, function(
							err,
							result
						) {
							if (err) {
								console.log(err);
								cbInner(err,"Error checking case_pdf for bucket key");
								return;
							}

							if (result.length > 0) {
								inBucket = true;
								pdfId = result[0].pdf_id;

								// find cases associated with this pdf
								connection.query("SELECT id,is_valid FROM cases WHERE pdf_id = ?",pdfId , function(
									err,
									resultCase
								) {
									if (err) {
										cbInner(err,"Error selecting cases associated with this pdf");
										return;
									}
									
									existingCaseId = resultCase[0].id;
									isValid = resultCase[0].is_valid === 1;
									
									// if (inBucket && isValid) {
										// console.log("Case already processed successfully")
										// ignoreCase = true;
									// }

									cbInner();
								});
								return;
							}

							cbInner();
						});
					},

					/**
					* Download PDF from MOJ
					*/
				   cbInner => {
					   	const url = lib.getMOJURL(caseData.id);
	   
					   	if (fs.existsSync(`${cacheDir}/${bucket_key}`)) {
							cbInner();
							return;
					   	}
						   
					   	// If pdf is already in bucket (and not processed), download from there not from MOJ
						// if (inBucket && !isValid) {
							s3.getObject(
								{
									Key: bucket_key
								},
								(err,data) => {
									console.log("dl")
									if (err) {
										console.log("err")
										cbInner(err,"Error with s3 download of existing bucket pdf");
										return;
									}
									fs.writeFileSync(`${cacheDir}/${bucket_key}`, data.Body);
									console.log(data)
									cbInner();
								}
								
							);
						// }
						// Otherwise download from MOJ
					   	// else if (!inBucket) {
						// 	download(url)
						// 		.then(data => {
						// 			fs.writeFileSync(`${cacheDir}/${bucket_key}`, data);
						// 			cbInner();
						// 		})
						// 		.catch(err => {
						// 				cbInner(err,"Error with pdf download url (MOJ)");
						// 				return;
						// 		});
						// }
						// else {
						// 	cbInner();
						// }
				   },
	   
				   /**
					* Convert PDF to text
					*/
					cbInner => {
						
						if (!ignoreCase) {
							const pathtopdf = path.resolve("../xpdf/bin64/pdftotext");
							const pathtocache = path.resolve(cacheDir);
							caseItem.case_text = "Unprocessed";
		
							let convertError = null;
							
							try {
								const child = execSync(
									pathtopdf + " " + pathtocache + "/" + bucket_key
								);
							}
							catch(err) {
								convertError = err;
								console.log("Error converting pdf to text, attempting to check if there is any salvagable text data.");
							}
						//process.stdout.write(child.toString())
						const noExtension = bucket_key.replace(/\.pdf/g, "");

							try {
								caseItem.case_text = fs.readFileSync(
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
							else {
								isValid = true;
							}
						}
					   	cbInner();
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
						cb();
						return;
					}
					cb();
				}
			),
			cb => async.series( 
				[
				// final - these functions should run after the above, even if the earlier ones fail,
				// so that any salvagable data is still kept
					
				/**
				* Upload to S3
				*/
				cbInner => {
					if (!inBucket && !ignoreCase) {
						s3.upload(
							{
								Key: bucket_key,
								Body: fs.readFileSync(
									`${cacheDir}/${bucket_key}`
								)
							},
							err => {
								if (err) {
									cbInner(err,"Error with s3 upload");
									return;
								}
								cbInner()
							}
							
						);
					}
					else {
						cbInner();
					}
				},

				/**
				* Insert pdf to case_pdf
				*/
				cbInner => {

					if (!inBucket && !ignoreCase) {
						let pdf = {};
						pdf.bucket_key= bucket_key;
						pdf.fetch_date = new Date();

						connection.query(
							"INSERT INTO case_pdf SET ?",
							pdf,
							function(err, result) {
								if (err) {
									cbInner(err,"Error with inserting pdf to case_pdf");
									return;
								}
								pdfId = result.insertId
								cbInner();
							}
						);
					}
					else {
						cbInner()
					}
				},

				/**
				 * Delete cached item
				 */
				cbInner => {
					try {
						fs.unlinkSync(`${cacheDir}/${bucket_key}`);
					}
					catch(err) {
						// ignore errors deleting this file, its possible it wasn't created
						// but either way should try delete in case it was. An error here is largely meaningless
					}

					try {
						fs.unlinkSync(`${cacheDir}/${bucket_key.replace(".pdf",".txt")}`);
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
					if (!ignoreCase) {
						// process.stdout.write("tidying object\n");
						caseItem.case_name = caseData.CaseName
							? lib.formatName(caseData.CaseName)
							: "Unknown case";
						// maybe rename table (and this) to be case_initial_citation ie the first citation found (if any)
						caseCitation.citation = caseData.CaseName
							? lib.getCitation(caseData.CaseName)
							: "";
						caseItem.case_date = caseData.JudgmentDate;
					}
					cbInner();
				},

				/**
				 * Insert case into database
				 */
				cbInner => {

					if (!ignoreCase) {
						// If an existing case exists with this pdf, update it
						// (if pdf was already valid, process would have exited by this point so assume invalid)
						caseItem.pdf_id = pdfId;
						caseItem.is_valid = isValid;

						if (existingCaseId) {
							connection.query("UPDATE cases SET ? " + `where id = ${existingCaseId}`,caseItem ,
								function(
									err,
									result
								) {
									if (err) {
										cbInner(err,"Error inserting into cases table");
										return;
									}
									caseCitation.case_id = existingCaseId;
									caseItem.id = existingCaseId;
									cbInner();
								});
						}
						else {
							connection.query("INSERT INTO cases SET ?",caseItem ,
							function(
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
						}
					}
					else {
						cbInner();
					}
					
				},

				/**
				 * Insert case citation into database
				 */
				// cbInner => {
				// 	if (!ignoreCase) {
				// 		connection.query(
				// 			"INSERT INTO case_citations SET ?",
				// 			caseCitation,
				// 			function(err, result) {
				// 				if (err) {
				// 					cbInner(err,"Error inserting into case_citations table");
				// 					return;
				// 				}
				// 				cbInner();
				// 			}
				// 		);
				// 	}
				// 	else {
				// 		cbInner();
				// 	}
				// }
				
				
				],
				(err, logMessage) => { //cbinner
					if (err) {
						console.log("Error in database insert for this case.");
						console.log("Data for this case will be missing from one or both of the case and case_citations tables");
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
