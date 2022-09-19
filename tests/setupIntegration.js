const { DockerComposeEnvironment, Wait } = require ( "testcontainers");
const path = require("path");

module.exports = async () => {

    const testTarantoolPath = path.resolve(__dirname, "./setup/docker");

    global.TARANTOOL_QUEUE = await new DockerComposeEnvironment(testTarantoolPath, "docker-compose.yml")
        .withWaitStrategy(
            "tarantool-queue",
            Wait.forLogMessage("ready to accept requests")
        )
        .up();
}