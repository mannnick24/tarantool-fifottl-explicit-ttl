const { DockerComposeEnvironment } = require ( "testcontainers");

module.exports = async () => {

    if (global.TARANTOOL_QUEUE) {
        global.TARANTOOL_QUEUE.down();
    }
}