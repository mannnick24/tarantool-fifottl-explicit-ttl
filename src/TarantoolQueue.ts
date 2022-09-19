import { EventEmitter } from "stream";
import TarantoolConnection = require("tarantool-driver");

const BATCH_SIZE = 20;
const RETRY_DELAY_MAX = 2000;
const INITIAL_WAIT_PERIOD: number = 300; // 300mS
const TARANTOOL_QUEUE_WAIT_PERIOD: number = 10; // 10 seconds
const TARANTOOL_COMMAND_TIMEOUT: number = 30000; // 30 seconds (>> 10 seconds)

export class TarantoolQueue {

    public events = new EventEmitter();
    protected connection: TarantoolConnection;
    private requestsInFlight: number = 0;
    private boundBackgroundTask = () => this.backgroundTask();
    public running: boolean;

    constructor() {
        this.running = true;
       // We want to use the buffering, so open a connection.
       const reserveHosts = [];
       let host = "localhost";
       let port = 13313;
       let username = "queue";
       let password = "test";
      
       this.connection = new TarantoolConnection({
           host,
           port,
           username,
           password,
           reserveHosts,
           retryStrategy(times) {
               return Math.min(times * 50, RETRY_DELAY_MAX);
           },
       }).on("reconnecting", (err) => {
            console.warn("Buffer connection lost " + err);
       }).on("connect", () => {
           console.log("Buffer connection now available");
           this.events.emit("ready");
       }).on("error", (err) => {
            console.warn("Buffer error: ", err);
       });
       setTimeout(this.boundBackgroundTask, INITIAL_WAIT_PERIOD);
    }

    protected tarantoolCall(fName: string, ...args: any[]): Promise<any> {
        // give testers a chance to override
        return this.connection.call(fName, ...args);
    }

    public async count(): Promise<number> {
        try {
            const response = await this.tarantoolCall("count");
            if (response != null && response[0] != null) {
                const count = response[0][0];
                if (count != null) {
                    return parseInt(count, 10);
                }
            }
        } catch (ex) {
            console.log("err in count", ex);
        }
        return Promise.resolve(0);
    }

    public async storeData(jsonPayload: string): Promise<void> {
        await this.tarantoolCall("storeTask", jsonPayload);
    }

    protected async backgroundTask() {
        if (!this.running) {
            this.events.emit("closed");
            return;
        }
        let count = 0;
        try {
            const data = await this.readNextBufferedEntries();
            let commandIds = "";
            if (data != null && data[0] != null) {
                const dataBlocks = data[0][0];
                if (dataBlocks) {
                    for (const property in dataBlocks) {
                        if (dataBlocks.hasOwnProperty(property)) {
                            const dataValue = dataBlocks[property];
                            const commandId = dataValue[0];
                            const jsonPayload = dataValue[2];
                            commandIds += " ," + commandId;
                            this.processRetrievedCommand(commandId, jsonPayload);
                        }
                    }
                    console.log("buffer took: " + commandIds);
                }
            }
            count = await this.count();
            console.log(`processed queue entries ${commandIds} queue length ${count}`);
        } catch (err) {
            if (err.message !== "Tarantool command timed out") {
                console.warn("Unable to read entry from buffer:  ", err);
                console.warn("buffer error: " + err.message);
            }
        }
        setTimeout(this.boundBackgroundTask, count === 0 ? RETRY_DELAY_MAX : 0);
    }

    /**
     * Retrieve the next events to be processed.
     */
    protected readNextBufferedEntries(): Promise<any> {
        console.log("background task run " + this.requestsInFlight);
        if (this.requestsInFlight < BATCH_SIZE) {
            const timeout = new Promise((resolve, reject) => {
                setTimeout(() => {
                    reject(new Error("Tarantool command timed out"));
                }, TARANTOOL_COMMAND_TIMEOUT);
            });
            const batchSize = BATCH_SIZE - this.requestsInFlight;
            const command = this.tarantoolCall("getNextTaskToProcess",
                                        batchSize,
                                        TARANTOOL_QUEUE_WAIT_PERIOD);
            return Promise.race([command, timeout]);
        }
        return Promise.resolve(null);
    }

    /**
     * We have retrieved a command from the Tarantool buffer. This method will attempt to run the
     * command on Elastic. If it succeeds, the entry is removed from the Tarantool database.
     * @param commandId the entry's ID (for deletion on successful Elastic operation)
     * @param jsonPayload the data to pass to Elastic
     */
    protected async processRetrievedCommand(commandId: number, jsonPayload: string): Promise<void> {
        this.requestsInFlight++;
        try {
            await new Promise(resolve => setTimeout(resolve, 20 * Math.random()));
            this.markCommandCompleted(commandId);
        } catch (err) {
            console.warn("Unable to deliver entry to Elastic: " + err);
        } finally {
            this.requestsInFlight--;
        }
    }

    public async markCommandCompleted(commandId: number): Promise<void> {
        try {
            await this.tarantoolCall("markTaskComplete", commandId);
        } catch (err) {
            console.warn("buffer complete err: " + err.message, err);
        }
    }

    public async countReadyTtr0(): Promise<number> {
        const count = await this.tarantoolCall("countReadyTtr0");
        return parseInt(count?.[0]?.[0], 10);
    }

    public async countTtl0(): Promise<number> {
        const count = await this.tarantoolCall("countTtl0");
        return parseInt(count?.[0]?.[0], 10);
    }

    public close() {
        this.running = false;
        this.connection.destroy();
    }
}
