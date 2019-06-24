const urlAdapter = require("./generic/url");

const run = async () => {
	
	try {
		
		const jsonURL = [
			`https://api.apify.com/v1/${process.env.APIFY_USER_ID}`,
			`/crawlers/${process.env.APIFY_CRAWLER_ID}`,
			`/lastExec/results?token=${process.env.APIFY_TOKEN}`
		].join("");

		const apifyData = await urlAdapter(jsonURL);

		const allLegislation = Array.prototype.concat.apply(
			[],
			apifyData.map(b => b.pageFunctionResult)
		);

		return allLegislation;
	} catch (ex) {
		throw ex;
	}
};

if (require.main === module) {
	try {
		throw new Error("Cannot be run individually.")
		//run();
	} catch (ex) {
		console.log(ex);
	}
} else {
	module.exports = run;
}
