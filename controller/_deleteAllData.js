const argv = require("yargs").argv;
if (!argv.env) {
	throw new Error("Missing env");
}
console.log(`Truncating all tables for env "${argv.env}" in 5 seconds`);

setTimeout(() => {
	(async () => {
		try {
			const connection = await require("../common/setup")(argv.env);
			await connection.query(`
			SET FOREIGN_KEY_CHECKS = 0; 
			TRUNCATE TABLE case_citations;
			TRUNCATE TABLE case_pdf;
			TRUNCATE TABLE cases;
			TRUNCATE TABLE cases_cited;
			TRUNCATE TABLE legislation;
			TRUNCATE TABLE legislation_to_cases; 
			SET FOREIGN_KEY_CHECKS = 1;`);
		} catch (ex) {
			console.log(ex);
		}
		console.log("Done");
	})().finally(process.exit);
}, 5000);
