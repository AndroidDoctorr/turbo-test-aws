const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')
const asyncHandler = require('express-async-handler')

const jwksUri = `https://cognito-idp.${process.env.REGION}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`
const issuer = `https://cognito-idp.${process.env.REGION}.amazonaws.com/${process.env.USER_POOL_ID}`
const client = jwksClient({ jwksUri })

// Function to get the signing key
const getKey = (header, callback) => {
    client.getSigningKey(header.kid, (err, key) => {
        var signingKey = key.publicKey || key.rsaPublicKey
        callback(null, signingKey)
    })
}

const createAuthenticationMiddleware = () => {
    return asyncHandler(async (req, res, next) => {
        const authorizationHeader = req.headers.authorization
        const handleInvalidHeader = () => {
            return res.status(400).json({ error: 'Invalid Authorization Header' })
        }

        if (!authorizationHeader)
            return next()

        const tokenParts = authorizationHeader.split(' ')
        if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer')
            return handleInvalidHeader()

        const idToken = tokenParts[1]
        if (!idToken)
            return handleInvalidHeader()

        try {
            // Verify the token
            jwt.verify(idToken, getKey, {
                audience: `${process.env.APP_CLIENT_ID}`,
                issuer,
                algorithms: ['RS256']
            }, (error, decodedToken) => {
                if (error) {
                    return res.status(403).json({ error: 'Invalid Token' })
                }
                req.user = decodedToken
                next()
            })
        } catch (error) {
            return res.status(403).json({ error: 'Invalid Token' })
        }
    })
}

module.exports = {
    createAuthenticationMiddleware
}
