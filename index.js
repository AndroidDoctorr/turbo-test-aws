const AWS = require('aws-sdk')
const { buildApp } = require('turbo-api')

AWS.config.update({ region: 'us-east-2' })
const dynamoDB = new AWS.DynamoDB.DocumentClient()

async function startServer() {
    const app = await buildApp()
    const corsOptions = {
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        allowedHeaders: 'Content-Type,Authorization',
        optionsSuccessStatus: 204,
    }

    app.use(cors(corsOptions))

    // JSON body parser
    app.use(express.json())

    const port = process.env.PORT
    app.listen(port, () => {
        console.log(`Server running on port ${port}`)
    })
}

startServer().catch(console.error)
