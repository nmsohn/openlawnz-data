const run = async (connection, pipeline_connection, logDir) => {
	console.log("\n-----------------------------------");
	console.log(`Resetting cases in 5 seconds`);
	console.log("-----------------------------------\n");

	return new Promise(resolve => {
		setTimeout(async () => {
			console.log('TRUNCATE "cases" tables');
			//if exists?
			// ALTER TABLE table_name DISABLE TRIGGER ALL;
			// TRUNCATE TABLE case_citations;
			// ALTER TABLE table_name EABLE TRIGGER ALL;

			//cascade

			// 			ALTER TABLE table1 ALTER CONSTRAINT fk_field1 DEFERRABLE INITIALLY DEFERRED;

			// Which I assume I can alter the field to be deferrable first and then using SET CONSTRAINTS ALL DEFERRED; to turn off the foreign key constraint check when truncate the table
			await connection
				.tx(t => {
					const q1 = t.none("SET session_replication_role to replica");
					const q2 = t.none("TRUNCATE TABLE case_citations");
					const q3 = t.none("TRUNCATE TABLE case_pdfs");
					const q4 = t.none("TRUNCATE TABLE courts");
					const q5 = t.none("TRUNCATE TABLE cases");
					const q6 = t.none("TRUNCATE TABLE cases_cited");
					const q7 = t.none("TRUNCATE TABLE legislation_to_cases");
					const q8 = t.none("SET session_replication_role to default");
					return t.batch([q1, q2, q3, q4, q5, q6, q7, q8]);
				})
				.then(result => {
					if (result != null) console.log(result);
					console.log("success");
				})
				.catch(err => {
					console.log("ERROR: ", err);
				});
			console.log('INSERT INTO "cases" tables FROM "pipeline_cases"');

			await pipeline_connection
				.tx(t => {
					const count = 0;
					const q1 = t.result(
						"INSERT INTO cases.case_pdfs SELECT * FROM pipeline_cases.case_pdfs",
						r => (count += r.rowCount)
					);
					const q2 = t.none(
						"INSERT INTO cases.cases (id, pdf_id, case_date, case_text, case_name, case_footnotes, case_footnote_contexts) SELECT id, pdf_id, case_date, case_text, case_name, case_footnotes, case_footnote_contexts FROM pipeline_cases.cases",
						r => (count += r.rowCount)
					);
					const q3 = t.none(
						"INSERT INTO cases.case_citations SELECT * FROM pipeline_cases.case_citations",
						r => (count += r.rowCount)
					);
					const q4 = t.none(
						"INSERT INTO cases.legislation SELECT * FROM pipeline_cases.legislation",
						r => (count += r.rowCount)
					);
					return t.batch([q1, q2, q3, q4]);
				})
				.then(result => {
					if (result != null) console.log("count: " + count);
					console.log("success");
				})
				.catch(err => {
					console.log("ERROR: ", err);
				});

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
