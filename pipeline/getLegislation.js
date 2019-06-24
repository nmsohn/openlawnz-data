const getDataFile = require('./getDataFile');
/**
 * Parse Legislation
 * @param MysqlConnection pipeline_connection
 */
const run = async (pipeline_connection, datasource, datalocation) => {

	console.log("Getting legislation data file");

	let allLegislation = await getDataFile(
		datasource, 
		datalocation,
	 );

	let insertValues = allLegislation.map(legislation => [
		legislation.title,
		legislation.link,
		legislation.year,
		legislation.alerts
	]);

	console.log(`Inserting ${insertValues.length} legislation`);

	if (insertValues.length > 0) {
		await pipeline_connection.query(
			"INSERT INTO legislation (title, link, year, alerts) VALUES ?",
			[insertValues]
		);
		pipeline_connection.end();
	}
};

if (require.main === module) {
	const argv = require("yargs").argv;
	(async () => {
		try {
			const { pipeline_connection } = await require("../common/setup")(argv.env);
			await run(
				pipeline_connection,
				argv.datasource, 
				argv.datalocation
			);
		} catch (ex) {
			console.log(ex);
		}
	})().finally(process.exit);
} else {
	module.exports = run;
}
