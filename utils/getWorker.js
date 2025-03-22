function getWorker(workers) {
    // Outside promise for the main program to resolve the desired worker
    return new Promise(async (resolve, reject) => {
        // inside promises (in array) for each worker to calculate it's useage
        const workersLoad = workers.map(worker => {
            // put this Promise on the array (will init as Pending)
            return new Promise(async (resolve, reject) => {
                const stats = await worker.getResourceUsage();
                // this calculates cumulative load, not current.
                // We'd need a setTimeout to do that
                const cpuUsage = stats.ru_utime + stats.ru_stime; // Example calculation
                // this worker is done, resolve it. Promise.all will run with all are done
                resolve(cpuUsage)
            })
        })
        const workersLoadCalc = await Promise.all(workersLoad)
        let leastLoadedWorker = 0;
        let leastWorkerLoad = 0
        for (let i = 0; i < workersLoadCalc.length; i++) {
            // console.log(workersLoadCalc[i])
            if (workersLoadCalc[i] < leastWorkerLoad) {
                leastLoadedWorker = i
            }
        }
        // console.log(leastLoadedWorker,leastWorkerLoad)
        resolve(workers[leastLoadedWorker])
    })
}
module.exports = getWorker