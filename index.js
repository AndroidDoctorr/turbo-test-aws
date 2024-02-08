const AWS = require('aws-sdk')
const { buildApp, serviceFactory } = require('turbo-api')
const { registerService, getAuthService, getDataService } = serviceFactory
AWS.config.update({ region: 'us-east-2' })
// const dynamoDB = new AWS.DynamoDB.DocumentClient()

async function startServer() {
    // Register AWS Services
    const DynamoDBService = require('./services/awsDataService')
    const WinstonLogger = require('./services/winstonLoggingService')
    const { createAuthenticationMiddleware } = require('./authServices/firebaseAuthService')
    registerService('aws', DynamoDBService, WinstonLogger, createAuthenticationMiddleware)

    const app = await buildApp()
    const corsOptions = {
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        allowedHeaders: 'Content-Type,Authorization',
        optionsSuccessStatus: 204,
    }

    app.use(cors(corsOptions))
    app.use(express.json())

    const port = process.env.PORT
    app.listen(port, () => {
        console.log(`Server running on port ${port}`)
    })
}

startServer().catch(console.error)
