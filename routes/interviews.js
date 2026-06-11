const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const interviews = all(`
      SELECT i.*,
        (SELECT COUNT(*) FROM time_slots WHERE interview_id = i.id) as slot_count,
        (SELECT COUNT(*) FROM bookings WHERE interview_id = i.id) as booking_count
      FROM interviews i
      ORDER BY i.created_at DESC
    `);
    res.json({ success: true, data: interviews });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { title, position, interviewer_name, interviewer_email, notes } = req.body;

    if (!title || !position || !interviewer_name || !interviewer_email) {
      return res.status(400).json({ success: false, error: '请填写所有必填字段' });
    }

    const id = uuidv4();
    const interviewer_token = uuidv4();
    const candidate_token = uuidv4();

    run(`
      INSERT INTO interviews
        (id, title, position, interviewer_name, interviewer_email, interviewer_token, candidate_token, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, title, position, interviewer_name, interviewer_email, interviewer_token, candidate_token, notes || null]);

    const interview = get('SELECT * FROM interviews WHERE id = ?', [id]);
    res.json({ success: true, data: interview });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/by-interviewer-token/:token', (req, res) => {
  try {
    const interview = get('SELECT * FROM interviews WHERE interviewer_token = ?', [req.params.token]);
    if (!interview) return res.status(404).json({ success: false, error: '链接无效' });
    const slots = all('SELECT * FROM time_slots WHERE interview_id = ? ORDER BY date, start_time', [interview.id]);
    res.json({ success: true, data: { interview, slots } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/by-candidate-token/:token', (req, res) => {
  try {
    const interview = get('SELECT * FROM interviews WHERE candidate_token = ?', [req.params.token]);
    if (!interview) return res.status(404).json({ success: false, error: '链接无效' });

    const slots = all(`
      SELECT s.*,
        CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END as is_booked,
        b.candidate_name as booked_by
      FROM time_slots s
      LEFT JOIN bookings b ON b.slot_id = s.id
      WHERE s.interview_id = ?
      ORDER BY s.date, s.start_time
    `, [interview.id]);

    const bookings = all('SELECT * FROM bookings WHERE interview_id = ? ORDER BY created_at', [interview.id]);

    res.json({ success: true, data: { interview, slots, bookings } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const interview = get('SELECT * FROM interviews WHERE id = ?', [req.params.id]);
    if (!interview) return res.status(404).json({ success: false, error: '未找到面试记录' });

    const slots = all(`
      SELECT s.*,
        CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END as is_booked,
        b.candidate_name as booked_by,
        b.candidate_email as booked_email,
        b.id as booking_id
      FROM time_slots s
      LEFT JOIN bookings b ON b.slot_id = s.id
      WHERE s.interview_id = ?
      ORDER BY s.date, s.start_time
    `, [interview.id]);

    const bookings = all('SELECT * FROM bookings WHERE interview_id = ? ORDER BY created_at', [interview.id]);

    res.json({ success: true, data: { interview, slots, bookings } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM bookings WHERE interview_id = ?', [req.params.id]);
    run('DELETE FROM time_slots WHERE interview_id = ?', [req.params.id]);
    run('DELETE FROM interviews WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
