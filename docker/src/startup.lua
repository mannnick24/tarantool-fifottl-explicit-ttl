#!/usr/bin/env tarantool

-- Maintainers please note:
-- 1. This file is multi-run safe. Please enure that it remains so.
-- 2. Although the fields in the Tarantool spaces (tables) have names, the code will often refer
--    to the field by its offset (and the offsets are 1-based). Do not add new fields into the
--    middle of the fields as this would change the numbering.
--    (Yes, you can read fields by name - but you first have to do a database access to get the
--     field number from the name. Although this is done 'behind the scenes' the lookup is still
--     done and we waant this code to be as fast as possible.))
-- 3. In Lua, variables have global scope unless
--    a) They have been declared as LOCAL
--    b) The control variables in a for loop are also treated as being local

-- Pick up the Tarantool Modules that we require and make them globally available
queue = require('queue')

-- Allow replication with only two servers - normally a Tarantool server will enter a
-- read-only state if the cluster does not contain replication_connect_quorum servers
-- (defaults to half of the servers plus one). This can stop the second server joining
-- the cluster if it cannot find a read-write server to sync to.
box.cfg{replication_connect_quorum=1}

-- Skip any replication conflicts if they arise. There shouldn't be any and the only
-- realistic recovery action is to ignore the conflict.
box.cfg{replication_skip_conflict=true}


-- Create a queue for the test
queue.create_tube('test_buffer', 'fifottl', {if_not_exists=true})

-- Add a buffer to the queue.
function storeTask(data)
    queue.tube.test_buffer:put(data, {ttr=60, ttl=15768000000000000})
end

-- Get the next buffer to process
function getNextTaskToProcess(numberToRead, timeout)
    local response = {}
    response[0] = queue.tube.test_buffer:take(timeout)
    for i = 1, numberToRead -1, 1 do
        local extra = queue.tube.test_buffer:take(.001)
        if extra ~= nil then
            response[i] = extra
        else
            break
        end
    end
    return response
end

-- Mark the buffer as being processed
function markTaskComplete(task_id)
    queue.tube.test_buffer:ack(task_id)
end

function count()
    return box.space.test_buffer:count()
end

function countTtl0()
    local ids = box.execute([[select "task_id" from "test_buffer" where "ttl" = 0;]])
    return #ids.rows
end

function countReadyTtr0()
    local ids = box.execute([[select "task_id" from "test_buffer" where "ttr" = 0 and "status" = 'r';]])
    return #ids.rows
end

-- vim: syntax=lua
