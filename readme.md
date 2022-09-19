**create buffer entries with an explicit ttl**

when this syntax is used to put data in the buffer

queue.tube.test_buffer:put(data, {ttr=60, ttl=15768000000000000})

You end up with entries that have a ttl of 0 and a large next_event time

**run**

`npm i`

`build.sh` (in docker)

`npm run test`

**issue**
after the test fails the buffer has entries in a state where the ttl is 0, but next event is large
`[[select "task_id" from "test_buffer" where "ttl" = 0;]]` 
the entries are not returned from take as they are expired, but they should not have expired