const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Meeting = require('../models/meeting');

const router = express.Router();

router.post('/new', async (req, res) => {
  try {
    const meetingId = uuidv4();
    const meetingLink = `${process.env.BASE_URL}/join/${meetingId}`;

    const meeting = new Meeting({ meetingId });
    await meeting.save();

    res.status(201).json({ meetingId, meetingLink });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

router.get('/validate/:meetingId', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.status(200).json({ meetingId: meeting.meetingId });
  } catch (error) {
    console.error('Error validating meeting:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;