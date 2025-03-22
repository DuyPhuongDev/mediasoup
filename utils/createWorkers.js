const os = require('os'); // we need this to get the number of CPUs in the system
const mediasoup = require('mediasoup'); // we need this to create a mediasoup worker
const totalThreads = os.cpus().length; // get the number of CPUs in the system => maximum number of workers
// console.log(totalThreads);

const config = require('../config/config');

const createWorkers = async () => new Promise(async (resolve, reject) => {
    let workers = [];

    for (let i = 0; i < totalThreads; i++) {
        const worker = await mediasoup.createWorker({
            // rtcMin and max are just the range of ports that mediasoup will use for WebRTC
            // usefull for firewall settings
            rtcMinPort: config.workerSettings.rtcMinPort,
            rtcMaxPort: config.workerSettings.rtcMaxPort,
            logLevel: config.workerSettings.logLevel,
            logTags: config.workerSettings.logTags
        });
        worker.on('died', () => {
            console.log("worker died, let's create a new one");
            process.exit(1); // kill the process if the worker dies
        });
        workers.push(worker);
    }
    resolve(workers);
});
module.exports = createWorkers;