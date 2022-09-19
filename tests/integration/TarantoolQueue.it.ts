import { TarantoolQueue } from "../../src/TarantoolQueue";

const data = {
    callUuid: "02-1b4f36d0-e081-11e9-8aa2-1700ba09cae4",
    taskId: "02-1b4f36d0-e081-11e9-8aa2-1700ba09cae4", tsCallStart: 1569518072515, callType: "Inbound",
    companyId: 13, companyName: "auto3", resellerId: 7, customerUri: "444400000000",
    userProvidedCli: "444400000000", serviceNumberId: 7, serviceNumber: "44420000002",
    serviceNumberName: "Service Number 44420000002", cliRestricted: false,
    activityHistory: [{
        msDuration: 20, activity: "CallFlowNavigation",
        endReason: "JoinedQueue", endParty: "Contact", ts: 1569518072535,
    },
    {
        msDuration: 27968, activity: "Queueing", endReason: "CallEnded", endParty: "Contact",
        ts: 1569518100503,
    },
    {
        activity: "ConnectingToCall", endReason: "AnsweredCall", endParty: "Agent",
        msDuration: 2039, ts: 1569517203756,
    }, {
        activity: "TalkingToContact", endReason: "CallEnded",
        endParty: "Contact", msDuration: 2479, ts: 1569517206235,
    }],
    connectedQueuePriorityIncreased: false,
    tsStart: 1569518072515, tsEnd: 1569517209235, msDuration: 27988, ender: "Contact",
    endNodeName: "JoinQueue", endReason: "CallEnded", voicemailHangup: false, voicemailMessage: false,
    endAgentId: 781, endAgentName: "agent 89", endVirtualAgentId: null, endQueueId: 7, endQueueName: "q1",
    releaseCause: 200, callQueued: true, callConnected: false, callDropped: true,
    msTotalHoldTime: 0, msTotalPreQueueTime: 20, msTotalQueueTime: 27968, msTotalTalkTime: 0,
    msWrapUpTime: 0, classification: 12, initialQueueId: 7, msCallDurationPostFirstTransfer: null,
    msCallTalkTimePostFirstTransfer: null, firstCallTransferType: null,
};
const RECORD_COUNT = 10000;
const stringData = JSON.stringify(data);

function putRecords(count: number, queue: TarantoolQueue): Promise<void> {
    return new Promise(async resolve => {
        for (let i = 0; i < count; i++) {
            await queue.storeData(stringData);
        }
        resolve();
    });
}

async function sleep(time: number) : Promise<void> {
    return new Promise(resolve => setTimeout(resolve, time));
}

describe("tarantoo-queue test", () => {

    let tarantoolQueue: TarantoolQueue;

    beforeEach(async () => {
        await new Promise(resolve => {
            tarantoolQueue = new TarantoolQueue();
            tarantoolQueue.events.on("ready", resolve);
        });
    });

    afterEach(async () => {
        const closed = new Promise(resolve => {
            tarantoolQueue.events.on("closed", resolve);
        })
        tarantoolQueue.close();
        await closed;
    });

    afterAll(async () => {
    });

    test("soak test", async () => {
        expect(await tarantoolQueue.count()).toBe(0);
        expect(await tarantoolQueue.countReadyTtr0()).toBe(0);
        expect(await tarantoolQueue.countTtl0()).toBe(0);
        const addRecords = putRecords(RECORD_COUNT, tarantoolQueue);
        await new Promise<void>(async resolve => {
            while (await tarantoolQueue.count() === 0) {
                await sleep(20);
            } 
            resolve();
        });
        await addRecords;
        await new Promise<void>(async (resolve, reject) => {
            while (await tarantoolQueue.count() > 0) {
                await sleep(1000);
                const count = await tarantoolQueue.count();
                const ttl0 = await tarantoolQueue.countTtl0();
                const readyttr0 = await tarantoolQueue.countReadyTtr0();

                if (ttl0 > 0) {
                    reject(`${ttl0}  ttl records left in the buffer`);
                }
                if (readyttr0 > 0) {
                    reject(`${readyttr0}  expired ttr records left in the buffer`);
                }
            }
            resolve();
        });
        expect(await tarantoolQueue.count()).toBe(0);
        expect(await tarantoolQueue.countReadyTtr0()).toBe(0);
        expect(await tarantoolQueue.countTtl0()).toBe(0);
    }, 6000000);
});

