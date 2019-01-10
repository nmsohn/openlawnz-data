const download = require("download");
const uuidv1 = require("uuid/v1");
const fs = require("fs");
const path = require("path");
const moment = require("moment");
const AWS = require("aws-sdk");
require("moment-timezone");
const argv = require("yargs").argv;
const common = require("../common/functions.js");
const setup = require("../common/db.js");

if (!argv.cases) {
	throw new Error("No cases passed in.");
}

if (!argv.env) {
	throw new Error("No env passed in");
}

const creds = new AWS.SharedIniFileCredentials({
	profile: process.env.AWS_PROFILE
});

AWS.config.credentials = creds;

const s3 = new AWS.S3({
	params: { Bucket: process.env.AWS_S3_BUCKET }
});

let pdfToTextAdapterName = argv.pdfToTextAdapter || "xpdf";
let pdfToTextAdapter;

switch (pdfToTextAdapterName) {
	case "autobatch":
		pdfToTextAdapter = require("./adapters/autobatch");
		break;
	case "xpdf":
		pdfToTextAdapter = require("./adapters/xpdf");
		break;
}

const cacheDir = __dirname + "/.cache";

fs.existsSync(cacheDir) || fs.mkdirSync(cacheDir);

const formatDate = date => {
	return moment(date)
		.tz("Pacific/Auckland")
		.format("YYYY-MM-DD");
};

const run = async legalCases => {
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
		throw new Error(
			"Malformed data. Ensure all fields are present. Returning."
		);
	}
	const connection = await setup(argv.env);

	const pdfDbKeys = legalCases.map(l => l.pdf_db_key);

	try {
		let newLegalCases;

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
					await download(l.pdf_url, pdfDownloadFolder, {
						filename: l.pdf_db_key
					});
					l.fetch_date = formatDate();
				} catch (ex) {
					console.log(ex);
				}
			}

			console.log("Converting to text");
			try {
				pdfToTextAdapter(path.resolve(pdfDownloadFolder));
			} catch (ex) {
				console.log(ex);
			}

			for (let l of newLegalCases) {
				console.log("Processing");
				const fileName = path.join(pdfDownloadFolder, l.pdf_db_key);
				const textFileName = fileName.replace(".pdf", ".txt");

				if (fs.existsSync(textFileName)) {
					const caseText = fs.readFileSync(textFileName).toString();

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
								case_name: l.case_name,
								pdf_id: casePDFResult.insertId,
								pdf_to_text_engine: pdfToTextAdapterName
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

		console.log("[PROCESSOR_RESULT]");
	} catch (ex) {
		console.log(ex);
	}
};

process.on("unhandledRejection", console.log);

run(JSON.parse(decodeURIComponent(argv.cases))).finally(process.exit);
