const AWS = require("aws-sdk");

const common = require("../../../common/functions");

const run = async (bucket, bucket_key, pathArr) => {
	const creds = new AWS.SharedIniFileCredentials({
		profile: process.env.AWS_PROFILE
	});

	AWS.config.credentials = creds;

	const s3 = new AWS.S3({
		params: { Bucket: bucket }
	});

	try {
		const jsonData = await s3
			.getObject({
				Key: bucket_key
			})
			.promise();

		const json = JSON.parse(jsonData);
		if (!pathArr) {
			return json;
		} else {
			return common.getNestedObject(json, pathArr);
		}
	} catch (ex) {
		throw ex;
	}
};

if (require.main === module) {
	try {
		run();
	} catch (ex) {
		console.log(ex);
	}
} else {
	module.exports = run;
}
