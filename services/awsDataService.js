const { DynamoDB } = require('aws-sdk')
const { NotFoundError } = require('../validation')

module.exports = class DynamoDBService {
    constructor(config) {
        this.config = config
        this.dynamodb = new DynamoDB(this.config)
    }

    async createDocument(tableName, data, userId, noMetaData = false) {
        const item = this.mapDataToItem(data)
        if (!noMetaData) {
            const now = Date.now().toString()
            item.created = { N: now }
            item.createdBy = { S: userId }
            item.modified = { N: now }
            item.modifiedBy = { S: userId }
        }
        item.isActive = { BOOL: true }
        const params = {
            TableName: tableName,
            Item: item,
        }
        await this.dynamodb.putItem(params).promise()
        return { id: data.id, ...data }
    }
    async getDocumentById(tableName, documentId, includeInactive = false) {
        const params = {
            TableName: tableName,
            Key: { id: { S: documentId } },
        }
        const response = await this.dynamodb.getItem(params).promise()
        const item = response.Item

        if (!item || (!item.isActive.BOOL && !includeInactive))
            throw new NotFoundError(`${tableName}:${documentId} not found`)

        return this.mapItemToData(item)
    }
    async getDocumentsByProp(tableName, propName, propValue, limit = 50, orderBy = null, includeInactive) {
        const params = {
            TableName: tableName,
            ExpressionAttributeNames: { '#propName': propName, ...(orderBy && { '#orderBy': orderBy }) },
            ExpressionAttributeValues: { ':propValue': propValue, ...(includeInactive && { ':isActive': true }) },
            FilterExpression: '#propName = :propValue',
            Limit: limit,
            ...(orderBy && { IndexName: orderBy }) // Assuming orderBy refers to a secondary index
        }
        if (!includeInactive) {
            params.ExpressionAttributeValues[':isActive'] = true
            params.FilterExpression += ' AND #isActive = :isActive'
        }
        const data = await this.dynamodb.scan(params).promise()
        return data.Items.map(item => this.mapItemToData(item))
    }
    async getDocumentsByProps(tableName, props, limit = 50, orderBy = null, includeInactive) {
        const filterExpressionParts = []
        const expressionAttributeValues = {}
        const expressionAttributeNames = {}

        for (const prop in props) {
            const attributeName = `#${prop}`
            const attributeValue = `:${prop}`
            filterExpressionParts.push(`${attributeName} = ${attributeValue}`)
            expressionAttributeValues[attributeValue] = props[prop]
            expressionAttributeNames[attributeName] = prop
        }
        if (!includeInactive) {
            filterExpressionParts.push('#isActive = :isActive')
            expressionAttributeValues[':isActive'] = true
            expressionAttributeNames['#isActive'] = 'isActive'
        }
        const params = {
            TableName: tableName,
            FilterExpression: filterExpressionParts.join(' AND '),
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            Limit: limit,
            ...(orderBy && { IndexName: orderBy }) // Assuming orderBy refers to a secondary index
        }
        const data = await this.dynamodb.scan(params).promise()
        return data.Items.map(item => this.mapItemToData(item))
    }
    async queryDocumentsByProp(tableName, propName, queryText, limit = 50, orderBy = null, includeInactive) {
        if (!orderBy) orderBy = propName // Default orderBy to propName if not specified

        const params = {
            TableName: tableName,
            KeyConditionExpression: '#propName BETWEEN :startVal AND :endVal',
            ExpressionAttributeNames: {
                '#propName': propName,
                ...(includeInactive && { '#isActive': 'isActive' })
            },
            ExpressionAttributeValues: {
                ':startVal': queryText.toLowerCase(),
                ':endVal': queryText.toLowerCase() + '\uf8ff',
                ...(includeInactive && { ':isActive': true })
            },
            Limit: limit,
            ScanIndexForward: true, // true for ascending, false for descending
            IndexName: orderBy, // Assuming orderBy is a secondary index
        }

        const data = await this.dynamodb.query(params).promise()
        return data.Items.map(item => this.mapItemToData(item))
    }
    async getDocumentsWhereInProp(tableName, propName, values, limit = 50, orderBy = null, includeInactive) {
        let results = []

        for (const value of values) {
            const params = {
                TableName: tableName,
                FilterExpression: '#propName = :propValue',
                ExpressionAttributeNames: {
                    '#propName': propName,
                    ...(includeInactive && { '#isActive': 'isActive' })
                },
                ExpressionAttributeValues: {
                    ':propValue': value,
                    ...(includeInactive && { ':isActive': true })
                },
                Limit: limit,
                ...(orderBy && { IndexName: orderBy }) // Assuming orderBy is a secondary index
            }

            const data = await this.dynamodb.scan(params).promise()
            results.push(...data.Items.map(item => this.mapItemToData(item)))
        }

        return results.slice(0, limit) // Ensure the total result count doesn't exceed the specified limit
    }
    async getAllDocuments(tableName, limit = 50, orderBy = null) {
        const params = {
            TableName: tableName,
            Limit: limit,
            ...(orderBy && { IndexName: orderBy }) // Assuming orderBy is a secondary index
        }

        const data = await this.dynamodb.scan(params).promise()
        return data.Items.map(item => this.mapItemToData(item))
    }
    async getActiveDocuments(tableName, limit = 50, orderBy = null) {
        const params = {
            TableName: tableName,
            ExpressionAttributeNames: {
                '#isActive': 'isActive',
            },
            ExpressionAttributeValues: {
                ':isActive': true,
            },
            FilterExpression: '#isActive = :isActive',
            Limit: limit,
            ...(orderBy && { IndexName: orderBy }) // Assuming orderBy is a secondary index
        }

        const data = await this.dynamodb.scan(params).promise()
        return data.Items.map(item => this.mapItemToData(item))
    }
    async getRecentDocuments(tableName, limit = 50) {
        const params = {
            TableName: tableName,
            IndexName: 'created-index', // This assumes you have a secondary index on the 'created' field
            ScanIndexForward: false, // false for descending order
            Limit: limit,
        }

        const data = await this.dynamodb.query(params).promise() // Using query instead of scan
        return data.Items.map(item => this.mapItemToData(item))
    }
    async getMyDocuments(tableName, userId, limit = 50, orderBy = null) {
        const params = {
            TableName: tableName,
            ExpressionAttributeNames: {
                '#isActive': 'isActive',
                '#createdBy': 'createdBy',
                ...(orderBy && { '#orderBy': orderBy })
            },
            ExpressionAttributeValues: {
                ':isActive': true,
                ':userId': userId
            },
            FilterExpression: '#isActive = :isActive AND #createdBy = :userId',
            Limit: limit,
            ...(orderBy && { IndexName: orderBy }) // Assuming orderBy is a secondary index
        }

        const data = await this.dynamodb.scan(params).promise()
        return data.Items.map(item => this.mapItemToData(item))
    }
    async getUserDocuments(tableName, userId, limit = 50, orderBy = null) {
        const params = {
            TableName: tableName,
            ExpressionAttributeNames: {
                '#createdBy': 'createdBy',
                ...(orderBy && { '#orderBy': orderBy })
            },
            ExpressionAttributeValues: {
                ':userId': userId
            },
            FilterExpression: '#createdBy = :userId',
            Limit: limit,
            ...(orderBy && { IndexName: orderBy }) // Assuming orderBy is a secondary index
        }

        const data = await this.dynamodb.scan(params).promise()
        return data.Items.map(item => this.mapItemToData(item))
    }
    async updateDocument(tableName, documentId, data, userId, noMetaData = false) {
        // Construct update expression
        let updateExpression = 'SET '
        let expressionAttributeValues = {}
        let expressionAttributeNames = {}

        for (const [key, value] of Object.entries(data)) {
            const attributeKey = `#${key}`
            const attributeValue = `:${key}`
            updateExpression += `${attributeKey} = ${attributeValue}, `
            expressionAttributeValues[attributeValue] = value
            expressionAttributeNames[attributeKey] = key
        }

        if (!noMetaData && userId) {
            const now = Date.now().toString()
            updateExpression += '#modified = :modified, #modifiedBy = :modifiedBy'
            expressionAttributeValues[':modified'] = now
            expressionAttributeValues[':modifiedBy'] = userId
            expressionAttributeNames['#modified'] = 'modified'
            expressionAttributeNames['#modifiedBy'] = 'modifiedBy'
        } else {
            updateExpression = updateExpression.slice(0, -2) // Remove last comma
        }

        const params = {
            TableName: tableName,
            Key: { 'id': documentId },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: 'ALL_NEW' // To get the updated document back
        }

        const result = await this.dynamodb.update(params).promise()
        return { id: documentId, ...result.Attributes }
    }
    async archiveDocument(tableName, documentId, userId, noMetaData = false) {
        return this.updateDocument(tableName, documentId, { isActive: false }, userId, noMetaData)
    }
    async dearchiveDocument(tableName, documentId, userId, noMetaData = false) {
        return this.updateDocument(tableName, documentId, { isActive: true }, userId, noMetaData)
    }
    async deleteDocument(tableName, documentId) {
        // Check if the document exists
        const getParams = {
            TableName: tableName,
            Key: { 'id': documentId }
        }
        const getResult = await this.dynamodb.getItem(getParams).promise()
        if (!getResult.Item) {
            throw new NotFoundError(`${tableName}:${documentId} not found`)
        }

        // Proceed to delete the document
        const deleteParams = {
            TableName: tableName,
            Key: { 'id': documentId }
        }
        await this.dynamodb.deleteItem(deleteParams).promise()
        return { id: documentId }
    }
    mapDataToItem(data) {
        const item = {}
        for (const [key, value] of Object.entries(data)) {
            if (this.schema[key]) {
                const attributeType = this.schema[key]
                item[key] = this.mapValueToAttributeType(value, attributeType)
            }
        }
        return item
    }
    mapValueToAttributeType(value, attributeType) {
        if (attributeType === 'S') {
            return { S: value }
        } else if (attributeType === 'N') {
            return { N: value.toString() }
        } else if (attributeType === 'BOOL') {
            return { BOOL: value }
        }
        // Other data types??
    }
}