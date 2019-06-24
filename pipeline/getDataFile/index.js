module.exports = async (datasource, datalocation) => {
	
	if (!datasource) {
		throw new Error("Missing datasource");
	}

	let retData;

	if (datasource === "moj") {

		retData = await require("./mojCases")();

	} else if (datasource === "pco") {

		if(!process.env.APIFY_USER_ID || !process.env.APIFY_CRAWLER_ID || !process.env.APIFY_TOKEN) {
			throw new Error("Missing Apify env variables");
		}

		retData = await require("./pcoLegislation")();
		
	} else if (datasource === "url") {

		if (!datalocation) {
			throw new Error("Missing datalocation");
		}

		retData = await require("./generic/url")(datalocation);

	} else if (datasource === "localfile") {

		if (!datalocation) {
			throw new Error("Missing datalocation");
		}

		retData = await require("./generic/localfile")(datalocation);

	} else {

		try {
			retData = JSON.stringify(JSON.parse(datasource));
		} catch (ex) {
			throw ex;
		}
	}

	return retData;

};
