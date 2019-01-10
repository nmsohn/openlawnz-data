const request = require("request-promise-native");

/**
 * Parse Legislation
 * @param MysqlConnection connection
 */
// populate the legislation table from API crawler
const run = async connection => {
	console.log("Parse legislation");

	const resp = await request(
		`https://api.apify.com/v1/${process.env.APIFY_USER_ID}/crawlers/${
			process.env.APIFY_CRAWLER_ID
		}/lastExec/results?token=${process.env.APIFY_TOKEN}`
	);

	const body = JSON.parse(resp);

	const allLegislation = Array.prototype.concat.apply(
		[],
		body.map(b => b.pageFunctionResult)
	);

	let insertValues = allLegislation.map(legislation => [
		legislation.title,
		legislation.link,
		legislation.year,
		legislation.alerts
	]);

	console.log("Insert", insertValues.length);
	if (insertValues.length > 0) {
		await connection.query(
			"INSERT INTO legislation (title, link, year, alerts) VALUES ?",
			[insertValues]
		);
	}
};

if (require.main === module) {
	const argv = require("yargs").argv;
	(async () => {
		try {
			const connection = await require("../common/setup")(argv.env);
			await run(connection);
		} catch (ex) {
			console.log(ex);
		}
	})().finally(process.exit);
} else {
	module.exports = run;
}
