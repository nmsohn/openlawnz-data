const download = require("download");
const uuidv1 = require("uuid/v1");
const fs = require("fs");
const path = require("path");
const moment = require("moment");
const AWS = require("aws-sdk");
const common = require("../common/functions.js");

// If legisation name has special characters in it
RegExp.escape = function(s) {
	return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
};

const run = async (env, legalCases, pdfConverterAdapter, localDataLocation) => {
	if (!legalCases) {
		throw new Error("No cases passed in.");
	}

	let newLegalCases = [];
	const connection = await require("../common/setup.js")(env);

	if (
		!Array.isArray(legalCases) ||
		legalCases.find(
			legalCase =>
				!legalCase.case_date ||
				!legalCase.case_name ||
				!legalCase.pdf_url ||
				!legalCase.pdf_db_key ||
				!legalCase.pdf_provider ||
				!legalCase.citations ||
				!Array.isArray(legalCase.citations)
		)
	) {
		await connection.query("INSERT INTO case_errors SET ?", {
			cases_array: JSON.stringify(legalCases)
		});

		console.log("Malformed data. Inserted into cases_errors. Returning.");

		return newLegalCases;
	}

	const creds = new AWS.SharedIniFileCredentials({
		profile: process.env.AWS_PROFILE
	});

	AWS.config.credentials = creds;

	const s3 = new AWS.S3({
		params: { Bucket: process.env.AWS_S3_BUCKET }
	});

	let pdfConverterAdapterName = pdfConverterAdapter || "xpdf";

	switch (pdfConverterAdapterName) {
		case "autobatch+word":
			pdfConverterAdapter = require("./adapters/autobatch+word");
			break;
		case "xpdf":
			pdfConverterAdapter = require("./adapters/xpdf");
			break;
	}

	const cacheDir = __dirname + "/.cache";

	fs.existsSync(cacheDir) || fs.mkdirSync(cacheDir);

	const formatDate = date => {
		return moment(date).format("YYYY-MM-DD");
	};

	const pdfDbKeys = legalCases.map(l => l.pdf_db_key);

	try {
		const [pdfsThatExist] = await connection.query(
			"SELECT pdf_db_key, pdf_id FROM case_pdf WHERE pdf_db_key IN (?)",
			[pdfDbKeys]
		);
		const pdfsThatExistDBKeys = pdfsThatExist.map(p => p.pdf_db_key);

		newLegalCases = legalCases.filter(
			l => pdfsThatExistDBKeys.indexOf(l.pdf_db_key) === -1
		);

		if (newLegalCases.length > 0) {
			console.log(`${newLegalCases.length} new cases`);
			const pdfDownloadFolder = path.join(cacheDir, uuidv1());
			fs.mkdirSync(pdfDownloadFolder);

			for (let l of newLegalCases) {
				try {
					if (localDataLocation) {
						const localPath = `${localDataLocation}\\${l.pdf_db_key}`;
						if (fs.existsSync(localPath)) {
							console.log(
								"Using local path",
								localPath,
								`${pdfDownloadFolder}\\${l.pdf_db_key}`
							);
							fs.copyFileSync(
								localPath,
								`${pdfDownloadFolder}\\${l.pdf_db_key}`
							);
						} else {
							await download(l.pdf_url, pdfDownloadFolder, {
								filename: l.pdf_db_key
							});
						}
					} else {
						await download(l.pdf_url, pdfDownloadFolder, {
							filename: l.pdf_db_key
						});
					}
					l.fetch_date = formatDate();
				} catch (ex) {
					console.log(ex);
				}
			}

			console.log("Converting");
			try {
				pdfConverterAdapter(path.resolve(pdfDownloadFolder));
			} catch (ex) {
				console.log(ex);
			}

			for (let l of newLegalCases) {
				console.log("Processing");
				const fileName = path.join(pdfDownloadFolder, l.pdf_db_key);
				const textFileName = fileName.replace(".pdf", ".txt");

				if (fs.existsSync(textFileName)) {
					const caseText = fs.readFileSync(textFileName).toString();

					let footnotes;
					let footnoteContexts;
					let footnoteContextsArray;
					let footnotesArray;
					let footnotesArrayLen;
					let currentFootnote = "";
					let processedFootnotes = [];
					let currentNumber = 1;
					let isValid = null;

					try {
						footnotes = fs
							.readFileSync(textFileName.replace(".txt", ".footnotes.txt"))
							.toString();
						footnoteContexts = fs
							.readFileSync(
								textFileName.replace(".txt", ".footnotecontexts.txt")
							)
							.toString();
						footnoteContextsArray = footnoteContexts
							.split("\n")
							.map(c => c.trim());
						footnotesArray = footnotes.split("\r").map(c => c.trim());
						footnotesArrayLen = footnotesArray.length;
					} catch (ex) {}

					if (footnotes || footnoteContexts) {
						isValid = false;
					}

					if (footnotes && footnoteContexts) {
						footnotesArray.forEach((footnoteContent, i) => {
							if (
								currentFootnote &&
								!footnoteContent.startsWith(currentNumber + 1)
							) {
								currentFootnote += " " + footnoteContent;
							} else if (currentFootnote) {
								processedFootnotes.push(currentFootnote);
								currentNumber++;
							}

							if (footnoteContent.startsWith(currentNumber)) {
								currentFootnote = footnoteContent;
							}
							if (i == footnotesArrayLen - 1) {
								processedFootnotes.push(currentFootnote);
							}
						});

						if (footnoteContextsArray.length === processedFootnotes.length) {
							for (let i = 0; i < footnoteContextsArray.length; i++) {
								const context = footnoteContextsArray[i];
								const footnote = processedFootnotes[i];

								// Check they exist in case text
								let footnoteMatchStr = RegExp.escape(footnote.trim()).replace(
									/\s+/g,
									"\\s+"
								);

								if (
									caseText.indexOf(context) !== -1 &&
									caseText.match(footnoteMatchStr)
								) {
									isValid = true;
								} else {
									isValid = false;
									break;
								}

								// Check they are correctly formatted
								const currentNumber = i + 1;

								if (
									context.endsWith(currentNumber) &&
									footnote &&
									footnote.startsWith(currentNumber)
								) {
									isValid = true;
								} else {
									isValid = false;
									break;
								}
							}
						}
					}

					try {
						await s3
							.upload({
								Key: l.pdf_db_key,
								Body: fs.readFileSync(fileName)
							})
							.promise();

						await connection.beginTransaction();

						const [casePDFResult] = await connection.query(
							"INSERT INTO case_pdf SET ?",
							{
								fetch_date: l.fetch_date,
								pdf_provider: l.pdf_provider,
								pdf_db_key: l.pdf_db_key,
								pdf_url: l.pdf_url,
								pdf_sha256: common.sha256File(fileName)
							}
						);

						const [caseResult] = await connection.query(
							"INSERT INTO cases SET ?",
							{
								case_date: formatDate(l.case_date),
								case_text: caseText,
								...(isValid
									? {
											case_footnotes: processedFootnotes.join("\n"),
											case_footnote_contexts: footnoteContextsArray.join("\n")
									  }
									: {
											case_footnotes: footnotes,
											case_footnote_contexts: footnoteContexts
									  }),
								case_footnotes_is_valid: isValid,
								case_footnotes_being_processed: false,
								case_name: l.case_name,
								pdf_id: casePDFResult.insertId,
								pdf_to_text_engine: pdfConverterAdapterName
							}
						);

						if (l.citations.length > 0) {
							const citationValues = l.citations.map(citation => [
								caseResult.insertId,
								citation
							]);
							await connection.query(
								"INSERT INTO case_citations (case_id, citation) VALUES ?",
								[citationValues]
							);
						}

						await connection.commit();
					} catch (ex) {
						await connection.rollback();
						console.log(ex);
					}
				} else {
					console.log("Missing file");
				}
			}
		}
	} catch (ex) {
		console.log(ex);
	}

	connection.end();

	return newLegalCases;
};

if (require.main === module) {
	const argv = require("yargs").argv;
	(async () => {
		try {
			await run(
				argv.env,
				JSON.parse(decodeURIComponent(argv.cases)),
				argv.pdfconverteradapter,
				argv.trylocaldatalocation
			);
		} catch (ex) {
			console.log(ex);
		}
	})().finally(process.exit);
} else {
	module.exports = run;
}
