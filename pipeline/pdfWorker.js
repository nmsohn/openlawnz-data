/*****************************************
 * Is given a list of case objects
 * Split into batches of 10 and process sequentially
 * For each batch, make a folder and run autobatcher
 * Keep going until finished, then exit
 ****************************************/

const fs = require('fs-extra');
const moment = require("moment");
const path = require("path");
const { exec } = require('child_process');
const download = require("download");
const adapterConfig = require("./adapterconfig.json");
const { parentPort, isMainThread, workerData } = require('worker_threads');

if (!isMainThread) {
	
	(async () => {
		
		const formatDate = date => {
			return moment(date).format("YYYY-MM-DD");
		};

		const { cacheDir, logDir, tryLocalDataLocation } = workerData;
		
		let cases = workerData.cases;
		let caseBatches = [];

		const watchFiles = (folder, localFilesFound) => {

			let watchCount = 0;
			let sentFiles = [];

			const watch = () => {

				let newFiles = [];
				const rawFiles =  fs.readdirSync(folder);
				const pdfFiles = rawFiles.filter(f => f.endsWith(".pdf"));
				const files = rawFiles.filter(f => f.endsWith(".docx") && !f.startsWith("~$")).map(f => path.join(folder, f));

				files.forEach(f => {
					if(sentFiles.indexOf(f) === -1) {
						newFiles.push(f);
						sentFiles.push(f);
					}
				});

				//console.log('[PDF] New files', newFiles);
				//console.log('[PDF] Sent files', sentFiles);

				if(newFiles.length > 0) {
					parentPort.postMessage({
						cmd: 'BATCH_READY',
						data: {
							localFilesFound,
							newBatch: newFiles,
							batchesRemaining: caseBatches.length
						}
					});
				}

				if(watchCount < 270 && sentFiles.length < pdfFiles.length) {
					setTimeout(watch, 3000);
				} else if(watchCount >= 270) {
					console.log('[PDF] Folder not completely processed');
					fs.writeFileSync(`${logDir}/error-pdf-process-${+new Date()}.txt`, 
						'Files:\n' + JSON.stringify(files, null, 4) + 
						'\nSent files:\n' + JSON.stringify(sentFiles, null, 4) + 
						'\nPDF files:\n' + JSON.stringify(pdfFiles), null, 4);
				} else {
					console.log('[PDF] Folder processed');
				}


				watchCount++;
			};

			watch();

		};

		const processBatch = async (caseBatch, pdfDownloadFolder) => {

			let localFilesFound = 0;
			
			fs.mkdirSync(pdfDownloadFolder);

			const doDownload = async l => {
				let didDownload = false;
				try {
					await download(l.pdf_url, pdfDownloadFolder, {
						filename: l.pdf_db_key
					});
					didDownload = true;
				} catch(ex) {
					fs.writeFileSync(`${logDir}/error-download-${l.pdf_db_key}.txt`, l.pdf_url + '\n' + ex);
				}
				return didDownload;
			};

			for (let l of caseBatch) {

				let pdfLoc = `${pdfDownloadFolder}\\${l.pdf_db_key}`;
				let didSucceed = false;
				
				try {
					if (tryLocalDataLocation) {
						const localPath = `${tryLocalDataLocation}\\${l.pdf_db_key}`;
						if (fs.existsSync(localPath)) {
							await fs.copyFile(
								localPath,
								pdfLoc
							);
							didSucceed = true;
							localFilesFound++;
						} else {
							didSucceed = await doDownload(l);
						}
					} else {
						didSucceed = await doDownload(l);
					}
					l.fetch_date = formatDate();
				} catch (ex) {
					console.log(ex);
				}

				if(didSucceed) {
					await fs.writeFile(`${pdfLoc}.meta.json`, JSON.stringify(l));
				}

			}

			console.log(`[PDF]\n- "${adapterConfig.autobatch_path}" "${pdfDownloadFolder}"`);
			
			exec(`"${adapterConfig.autobatch_path}" "${pdfDownloadFolder}"`);

			watchFiles(pdfDownloadFolder, localFilesFound);

		};

		// Make batches
		while (cases.length > 0) {
			caseBatches.push(cases.splice(0, Math.min(cases.length, 10)));
		}

		await new Promise((resolve, reject) => {
			
			parentPort.on('message', async msg => {
				
				switch (msg.cmd) {
					case 'START':

						const batchToProcess = caseBatches.shift();
						processBatch(batchToProcess, path.join(cacheDir, +new Date() + ""));
				
					break;

				}
				
			});

		});
		
	})().finally(process.exit);

}