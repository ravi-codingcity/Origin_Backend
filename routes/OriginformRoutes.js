const express = require('express');
const router = express.Router();
const formController = require('../controllers/OriginformController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create', authMiddleware, formController.createForm); // Protected route for creating a form
router.put('/:id', authMiddleware, formController.editForm); // Protected route for editing a form
router.delete('/:id', authMiddleware, formController.deleteForm); // Protected route for deleting a form
router.get('/all', formController.getAllForms); // Public route for getting all forms
router.get('/user', authMiddleware, formController.getUserForms); // Protected route for getting user-specific forms

module.exports = router;
