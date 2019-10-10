const fs = require('fs-extra');
const path = require('path');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const moment = require('moment');
const argv = require('yargs').argv;
const getDataFile = require('./getDataFile');
const adapterConfig = require('./adapterconfig');
const { Worker } = require('worker_threads');
const common = require('../common/functions.js');
const find = require('find-process');

if (require.main === module) {
	(async () => {
		try {
			/*****************************************
			 * Variables
			 ****************************************/

			const { pipeline_connection, logDir, cacheDir, sessionId } = await require('../common/setup')(
				argv.env,
				argv.resumeSessionId
			);
			let copyTo = path.join(argv.copyto, sessionId);
			let AWSCreds;
			let s3;
			let allCases;
			let validCases = [];
			let newCases = [];
			let hasInitialised = false;
			let processedCount = 0;
			let processedWordFileSizes = [];
			let processingStarted = moment();
			let lastWordProcessesCount;

			/*****************************************
			 * Methods
			 ****************************************/

			// TODO: Move to common
			const formatDate = (date) => {
				return moment(date).format('YYYY-MM-DD');
			};

			// Set up DB entry for when each Word file has finished

			const dbProcessor = async (docxFileName) => {
				try {
					console.log('[CORE] Loading into database');
					// TODO: rename to say path, e.g. filePath
					// TODO: generally remove replace's
					const fileName = docxFileName.replace('.docx', '.pdf');
					const textFileName = fileName.replace('.pdf', '.txt');
					const legalCase = JSON.parse(fs.readFileSync(fileName + '.meta.json'));

					if (fs.existsSync(textFileName)) {
						const caseText = fs.readFileSync(textFileName).toString();

						let footnotes = null;
						let footnoteContexts = null;

						try {
							footnotes = fs.readFileSync(textFileName.replace('.txt', '.footnotes.txt')).toString();
							footnoteContexts = fs
								.readFileSync(textFileName.replace('.txt', '.footnotecontexts.txt'))
								.toString();
						} catch (ex) {}

						try {
							if (copyTo === 'S3') {
								// await s3
								// 	.upload({
								// 		Key: legalCase.pdf_db_key,
								// 		Body: fs.readFileSync(fileName)
								// 	})
								// 	.promise();
							} else {
								console.log('[CORE] Copying file');
								console.log(`- ${fileName}`);
								console.log(`- ${copyTo}/${path.basename(fileName)}`);
								await fs.copy(fileName, `${copyTo}/${path.basename(fileName)}`, { overwrite: true });
							}

							await pipeline_connection.beginTransaction();

							const [ casePDFResult ] = await pipeline_connection.query('INSERT INTO case_pdfs SET ?', {
								fetch_date: legalCase.fetch_date,
								pdf_provider: legalCase.pdf_provider,
								pdf_db_key: legalCase.pdf_db_key,
								pdf_url: legalCase.pdf_url,
								pdf_sha256: common.sha256File(fileName)
							});

							const [ caseResult ] = await pipeline_connection.query('INSERT INTO cases SET ?', {
								case_date: formatDate(legalCase.case_date),
								case_text: caseText,
								case_footnotes: footnotes,
								case_footnote_contexts: footnoteContexts,
								case_name: legalCase.case_name,
								pdf_id: casePDFResult.insertId,
								pdf_to_text_engine: ''
							});

							if (legalCase.citations.length > 0) {
								const citationValues = legalCase.citations.map((citation) => [
									caseResult.insertId,
									citation
								]);
								await pipeline_connection.query(
									'INSERT INTO case_citations (case_id, citation) VALUES ?',
									[ citationValues ]
								);
							}

							await pipeline_connection.commit();
						} catch (ex) {
							await pipeline_connection.rollback();
							console.log(ex);
							fs.writeFileSync(`${logDir}/error-db-${legalCase.pdf_db_key}.txt`, ex);
						}
					} else {
						console.log('Missing file');
					}

					console.log('[CORE] Processed Record');
					processedCount++;
				} catch (ex) {
					console.log(ex);
					fs.writeFileSync(`${logDir}/error-db-${legalCase.pdf_db_key}.txt`, ex);
				}
			};

			const dbError = async (legalCase) => {
				const errorData = JSON.stringify(legalCase);
				const errorSHA = crypto.createHash('sha256');
				errorSHA.update(errorData);
				const error_sha256 = errorSHA.digest('hex');
				await pipeline_connection.query('INSERT INTO case_errors SET ?', {
					error_sha256: error_sha256,
					// TODO: Change
					cases_array: JSON.stringify(legalCase)
				});
			};

			console.log(`[CORE] Session ID: ${sessionId}`);
			console.log(`- copyTo: ${copyTo}`);
			console.log(`- logDir: ${logDir}`);
			console.log(`- cacheDir: ${cacheDir}`);

			/*****************************************
			 * Initialise variables
			 * Validate arguments
			 ****************************************/

			if (copyTo === 'S3') {
				if (!process.env.AWS_PROFILE || !process.env.AWS_S3_BUCKET) {
					throw new Error('No AWS profile or AWS bucket in env');
				}

				AWSCreds = new AWS.SharedIniFileCredentials({
					profile: process.env.AWS_PROFILE
				});

				AWS.config.credentials = AWSCreds;

				s3 = new AWS.S3({
					params: { Bucket: process.env.AWS_S3_BUCKET }
				});
			} else {
				await fs.ensureDir(copyTo);
			}

			console.log('[CORE] Getting data');

			// Get the cases data file to process
			allCases = await getDataFile(argv.datasource, argv.datalocation);

			console.log('[CORE] Filtering invalid data');

			// Strip out invalid cases
			for (let i = 0; i < allCases.length; i++) {
				let legalCase = allCases[i];

				if (
					!legalCase.case_date ||
					!legalCase.case_name ||
					!legalCase.pdf_url ||
					!legalCase.pdf_db_key ||
					!legalCase.pdf_provider ||
					!legalCase.citations ||
					!Array.isArray(legalCase.citations) ||
					(Array.isArray(legalCase.citations) && legalCase.citations.some((l) => l !== null && l.length > 50))
				) {
					await dbError(legalCase);
				} else {
					legalCase.citations = legalCase.citations.filter((c) => c !== null);

					validCases.push(legalCase);
				}
			}

			console.log('[CORE] ' + validCases.length + '/' + allCases.length + ' are valid');

			// Strip out cases that exist
			const [ pdfsThatExist ] = await pipeline_connection.query('SELECT pdf_db_key, pdf_id FROM case_pdfs');

			newCases = validCases.filter((legalCase) => {
				return !pdfsThatExist.some((legalCaseThatExists) => {
					return legalCaseThatExists.pdf_db_key == legalCase.pdf_db_key;
				});
			});

			console.log('[CORE] ' + newCases.length + '/' + validCases.length + ' are new');

			/*****************************************
			 * Make workers
			 ****************************************/

			let wordWorker;
			let pdfWorker;
			let pdfWorkerCanStop = false;

			const checkWord = () => {
				if (processedCount === newCases.length) {
					console.log('Done.');
					wordWorker.terminate();
					pdfWorker.terminate();
					return;
				}

				find('name', 'WINWORD.EXE').then(function(list) {
					// Processes are doubled
					const wordProcessesCount = Math.ceil(list.length / 2);

					if (wordProcessesCount !== lastWordProcessesCount) {
						console.log(`\n----------------[STATUS]----------------`);
						console.log(`Start Time: ${processingStarted}`);
						console.log(`Time Now: ${moment()}`);
						console.log(`${processedCount}/${newCases.length} cases inserted`);
						const minutesElapsed = moment().diff(processingStarted, 'minutes');
						if (processedCount > 0 && minutesElapsed > 0) {
							const perMinute = processedCount / minutesElapsed;
							const totalMinsToCompletion = (newCases.length - processedCount) / perMinute;
							const totalHours = totalMinsToCompletion / 60;
							const totalDays = totalHours / 24;

							const remainingDays = Math.floor(totalDays);
							const remainingHoursDec = (totalDays - remainingDays) * 24;
							const remainingHours = Math.floor(remainingHoursDec);
							const remainingMins = Math.round((remainingHoursDec - remainingHours) * 60);

							console.log(`- Average processing time: ${Math.round(perMinute)}/min`);
							console.log(`- ETA ${remainingDays} days, ${remainingHours}hrs, ${remainingMins}mins`);
						}
						if (processedWordFileSizes.length > 0) {
							console.log(
								`- Average Word file size: ${Math.round(
									processedWordFileSizes.reduce((accumulator, current) => accumulator + current, 0) /
										processedWordFileSizes.length
								)}kb`
							);
						}
						console.log(`- wordProcessesCount: ${wordProcessesCount}`);
						if (pdfWorkerCanStop) {
							console.log(`[!] pdfWorkerCanStop`);
						}
						console.log(`----------------------------------------\n`);
					}

					lastWordProcessesCount = wordProcessesCount;

					if (hasInitialised) {
						if (
							wordProcessesCount <= adapterConfig.start_pdf_processor_at_word_processors_count &&
							!pdfWorkerCanStop
						) {
							find('name', 'Acrobat.exe').then(function(list) {
								if (list.length === 0) {
									console.log(`[CORE->PDF] Process next batch`);
									pdfWorker.postMessage({
										cmd: 'START'
									});
								} else {
									console.log('[CORE] PDF processor running. Waiting for next loop');
								}
							});
						}
					}

					setTimeout(checkWord, 10000);
				});
			};

			const sendNewBatch = (newBatch) => {
				console.log('[CORE->WORD] Update Current Batch');

				wordWorker.postMessage({
					cmd: 'UPDATE_BATCH_QUEUE',
					data: {
						newBatch: newBatch
					}
				});
			};

			await Promise.all([
				new Promise((resolve, reject) => {
					// Word worker wil listen to pdf worker outputs
					// When the Word worker finishes each file, insert into DB
					wordWorker = new Worker('./wordWorker.js', {
						workerData: {
							cacheDir,
							logDir
						}
					});

					wordWorker.on('online', () => {
						console.log('[WORD->CORE] Word Worker is online');
					});

					wordWorker.on('error', (err) => {
						console.log('[WORD->CORE] Word Worker error');
						console.log(err);
						reject();
					});

					wordWorker.on('exit', (code) => {
						console.log(`[WORD] Exiting with code ${code}`);
						resolve();
					});

					wordWorker.on('message', (msg) => {
						switch (msg.cmd) {
							case 'INITIALISED':
								hasInitialised = true;
								console.log('[!] [WORD->CORE] Initialised, now able to load up other batches');
								checkWord();
								break;
							case 'PROCESS':
								console.log('[WORD->CORE] Process Queued');
								dbProcessor(msg.data.path);
								processedWordFileSizes.push(msg.data.fileSize);
								break;
						}
					});
				}),

				new Promise((resolve, reject) => {
					// PDF worker batches cases into 10 for autobatch to run
					// Word worker will listen to the output
					pdfWorker = new Worker('./pdfWorker.js', {
						workerData: {
							cacheDir,
							logDir,
							cases: newCases,
							tryLocalDataLocation: argv.trylocaldatalocation
						}
					});

					pdfWorker.on('online', () => {
						console.log('[PDF->CORE] PDF Worker is online');
						// Start it off
						pdfWorker.postMessage({
							cmd: 'START'
						});
					});

					pdfWorker.on('error', (err) => {
						console.log('[PDF->CORE] PDF Worker error');
						console.log(err);
						reject();
					});

					pdfWorker.on('exit', (code) => {
						console.log(`[PDF] Exiting with code ${code}`);
						resolve();
					});

					pdfWorker.on('message', (msg) => {
						switch (msg.cmd) {
							case 'BATCH_READY':
								console.log('[PDF->CORE] Batch Ready');
								sendNewBatch(msg.data.newBatch);
								pdfWorkerCanStop = msg.data.batchesRemaining === 0;
								break;
						}
					});
				})
			]);
		} catch (ex) {
			console.log(ex);
		}
	})().finally(process.exit);
} else {
	throw new Error('Must be run directly');
}
