const run = async (connection, pipeline_connection, logDir) => {
	console.log("\n-----------------------------------");
	console.log(`Resetting cases in 5 seconds`);
	console.log("-----------------------------------\n");

	return new Promise(resolve => {
		setTimeout(async () => {
			console.log('TRUNCATE "cases" tables');

			//if exists?
			await connection.query(`
				SET FOREIGN_KEY_CHECKS = 0; 
				TRUNCATE TABLE case_citations;
				TRUNCATE TABLE case_pdfs;
				TRUNCATE TABLE court_to_cases;
				TRUNCATE TABLE courts;
				TRUNCATE TABLE cases;
				TRUNCATE TABLE cases_cited;
				TRUNCATE TABLE legislation_to_cases; 
				SET FOREIGN_KEY_CHECKS = 1;
			`);

			console.log('INSERT INTO "cases" tables FROM "pipeline_cases"');

			await pipeline_connection.query(`
				INSERT INTO cases.case_pdfs SELECT * FROM pipeline_cases.case_pdfs;
				INSERT INTO cases.cases (id, pdf_id, case_date, case_text, case_name, case_footnotes, case_footnote_contexts) 
					SELECT id, pdf_id, case_date, case_text, case_name, case_footnotes, case_footnote_contexts 
					FROM pipeline_cases.cases;
				INSERT INTO cases.case_citations SELECT * FROM pipeline_cases.case_citations;
				INSERT INTO cases.legislation SELECT * FROM pipeline_cases.legislation;
			`);
			console.log("Done");
			resolve();
		}, 5000);
	});
};

if (require.main === module) {
	const argv = require("yargs").argv;
	(async () => {
		try {
			const {
				connection,
				pipeline_connection,
				logDir
			} = await require("../common/setup")(argv.env);
			await run(connection, pipeline_connection, logDir);
		} catch (ex) {
			console.log(ex);
		}
	})().finally(process.exit);
} else {
	module.exports = run;
}
