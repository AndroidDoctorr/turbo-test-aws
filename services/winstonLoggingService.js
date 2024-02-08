const winston = require('winston')
const WinstonCloudWatch = require('winston-cloudwatch')

class WinstonLogger {
    constructor(config) {
        // Destructure the config object to get required properties
        const { awsAccessKeyId, awsSecretKey, awsRegion, logGroupName, logStreamName } = config

        // Validate required properties
        if (!awsAccessKeyId || !awsSecretKey || !awsRegion || !logGroupName || !logStreamName) {
            throw new Error('Incomplete AWS credentials or log configuration.')
        }

        // Create a Winston logger instance
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new WinstonCloudWatch({
                    logGroupName,
                    logStreamName,
                    awsAccessKeyId,
                    awsSecretKey,
                    awsRegion,
                }),
            ],
        })
    }

    log(message) {
        this.logger.log('info', message)
    }

    info(message) {
        this.logger.info(message)
    }

    warn(message) {
        this.logger.warn(message)
    }

    error(message) {
        this.logger.error(message)
    }
}

module.exports = WinstonLogger