const express = require('express')
const response = require('../network/response')
const ctrl = require('../database/postgresql')
const route = express.Router()

const tableInjected = 'test'

route.get('/:table', async (req, res) => {
    try {
        const list = await ctrl.listAll(tableInjected)
        response.success(req, res, list, 200)
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
})


//route.post('/post', listAll)
//route.put('/update', listAll)


const list =

    module.exports = route