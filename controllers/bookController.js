const { ControllerBase, validation } = require('turbo-api')
const { stringRule, numberRule } = validation

const BOOK_COLLECTION = 'Books'
const BOOK_PROPS = ['title', 'pages', 'isbn']

const bookValidationRules = {
    title: stringRule(10, 1000, true),
    pages: numberRule(0),
    isbn: stringRule(8, 200),
}

class BookController extends ControllerBase {
    constructor() {
        super(BOOK_COLLECTION, bookValidationRules, BOOK_PROPS)
    }

    configureRoutes() {
        this.fullCRUD({ isPublicGet: true })
    }
}

module.exports = {
    controller: BookController,
    BOOK_COLLECTION,
    BOOK_PROPS,
    bookValidationRules,
}