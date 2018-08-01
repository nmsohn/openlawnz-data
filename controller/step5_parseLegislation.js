const request = require("request");
const fs = require("fs");
const async = require("async");
/**
 * Parse Legislation
 * @param MysqlConnection connection
 * @param {function} cb
 */
// populate the legislation table from API crawler
const run = (connection, cb) => {
	console.log("Parse legislation");

	request(
		`https://api.apify.com/v1/${process.env.APIFY_USER_ID}/crawlers/${
			process.env.APIFY_CRAWLER_ID
		}/lastExec/results?token=${process.env.APIFY_TOKEN}`,
		function(err, response, body) {
			if (err) {
				cb(err);
				return;
			}

			body = JSON.parse(body);

			fs.writeFileSync("../.cache/_dl", JSON.stringify(body, null, 4))

			const allLegislation = Array.prototype.concat.apply(
				[],
				body.map(b => b.pageFunctionResult)
			);




			async.parallelLimit(
				allLegislation.map(legislation => {
					return function(cb) {
						connection.query(
							"INSERT INTO legislation SET ?", legislation,
							function(err, results, fields) {
								if (err) {
									cb(err);
									return;
								}

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
					console.log("step5 done")
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
