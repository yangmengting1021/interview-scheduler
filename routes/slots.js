const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../db/database');

// 面试官提交可用时间段
router.post('/interviewer/:token', (req, res) => {
  try {
    const interview = get('SELECT * FROM interviews WHERE interviewer_token = ?', [req.params.token]);
    if (!interview) return res.status(404).json({ success: false, error: '链接无效' });

    // 检查是否已有候选人预约了某些时间段
    const existingBookings = all('SELECT slot_id FROM bookings WHERE interview_id = ?', [interview.id]);
    const bookedSlotIds = new Set(existingBookings.map(b => b.slot_id));

    // 删除未被预约的旧时间段
    if (bookedSlotIds.size > 0) {
      const placeholders = Array(bookedSlotIds.size).fill('?').join(',');
      run(`DELETE FROM time_slots WHERE interview_id = ? AND id NOT IN (${placeholders})`,
        [interview.id, ...bookedSlotIds]);
    } else {
      run('DELETE FROM time_slots WHERE interview_id = ?', [interview.id]);
    }

    const { slots } = req.body;
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ success: false, error: '请至少添加一个时间段' });
    }

    for (const slot of slots) {
      const id = uuidv4();
      run(
        'INSERT INTO time_slots (id, interview_id, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
        [id, interview.id, slot.date, slot.start_time, slot.end_time]
      );
    }

    run(
      "UPDATE interviews SET status = 'pending_candidate', updated_at = datetime('now','localtime') WHERE id = ?",
      [interview.id]
    );

    res.json({ success: true, message: '时间段已保存，候选人可以开始预约了' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 候选人预约时间段
router.post('/candidate/:token', (req, res) => {
  try {
    const interview = get('SELECT * FROM interviews WHERE candidate_token = ?', [req.params.token]);
    if (!interview) return res.status(404).json({ success: false, error: '链接无效' });
    if (interview.status === 'pending_interviewer') {
      return res.status(400).json({ success: false, error: '面试官尚未设置可用时间' });
    }

    const { slot_id, candidate_name, candidate_email, candidate_phone } = req.body;
    if (!slot_id) return res.status(400).json({ success: false, error: '请选择一个时间段' });
    if (!candidate_name || !candidate_email) {
      return res.status(400).json({ success: false, error: '请填写姓名和邮箱' });
    }

    // 检查该时间段是否已被预约
    const existingBooking = get('SELECT * FROM bookings WHERE slot_id = ?', [slot_id]);
    if (existingBooking) {
      return res.status(409).json({ success: false, error: '抱歉，该时间段刚刚已被其他候选人预约，请刷新页面重新选择' });
    }

    // 检查该候选人是否已预约过（同一邮箱不能重复预约）
    const prevBooking = get('SELECT * FROM bookings WHERE interview_id = ? AND candidate_email = ?',
      [interview.id, candidate_email]);
    if (prevBooking) {
      return res.status(400).json({ success: false, error: '您已预约过该面试，请勿重复预约' });
    }

    const slot = get('SELECT * FROM time_slots WHERE id = ? AND interview_id = ?', [slot_id, interview.id]);
    if (!slot) return res.status(400).json({ success: false, error: '时间段不存在' });

    const bookingId = uuidv4();
    run(
      'INSERT INTO bookings (id, slot_id, interview_id, candidate_name, candidate_email, candidate_phone) VALUES (?, ?, ?, ?, ?, ?)',
      [bookingId, slot_id, interview.id, candidate_name, candidate_email, candidate_phone || null]
    );

    // 更新面试状态为已有预约
    run(
      "UPDATE interviews SET status = 'has_bookings', updated_at = datetime('now','localtime') WHERE id = ?",
      [interview.id]
    );

    const booking = get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    res.json({ success: true, data: { interview, slot, booking } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 候选人取消预约
router.delete('/booking/:bookingId', (req, res) => {
  try {
    const booking = get('SELECT * FROM bookings WHERE id = ?', [req.params.bookingId]);
    if (!booking) return res.status(404).json({ success: false, error: '预约记录不存在' });

    run('DELETE FROM bookings WHERE id = ?', [req.params.bookingId]);

    // 检查该面试是否还有剩余预约
    const remaining = all('SELECT * FROM bookings WHERE interview_id = ?', [booking.interview_id]);
    if (remaining.length === 0) {
      run("UPDATE interviews SET status = 'pending_candidate', updated_at = datetime('now','localtime') WHERE id = ?",
        [booking.interview_id]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
