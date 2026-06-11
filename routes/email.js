const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { get, all } = require('../db/database');

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  });
}

function getBaseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// 发送邮件给面试官（让面试官设时间）
router.post('/send-interviewer/:interviewId', async (req, res) => {
  try {
    const interview = get('SELECT * FROM interviews WHERE id = ?', [req.params.interviewId]);
    if (!interview) return res.status(404).json({ success: false, error: '面试记录不存在' });

    const baseUrl = getBaseUrl(req);
    const link = `${baseUrl}/interviewer/${interview.interviewer_token}`;

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"面试预约系统" <${process.env.SMTP_USER}>`,
      to: interview.interviewer_email,
      subject: `【面试邀请】请设置您的空闲时间 - ${interview.position}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;">您好，${interview.interviewer_name}</h2>
          <p style="color:#444;line-height:1.7;">
            HR 邀请您参与 <strong>${interview.position}</strong> 岗位的面试安排。<br>
            请点击下方按钮设置您方便的面试时间段，候选人将在您设置完毕后自行选择。
          </p>
          <div style="margin:32px 0;">
            <a href="${link}" style="background:#534AB7;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:15px;">
              设置我的空闲时间
            </a>
          </div>
          <p style="color:#888;font-size:13px;">
            或复制此链接到浏览器打开：<br>
            <a href="${link}" style="color:#534AB7;">${link}</a>
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="color:#aaa;font-size:12px;">此邮件由面试预约系统自动发送，请勿回复。</p>
        </div>
      `
    });

    res.json({ success: true, message: '邮件已发送给面试官' });
  } catch (err) {
    console.error('邮件发送失败:', err);
    res.status(500).json({ success: false, error: '邮件发送失败: ' + err.message });
  }
});

// 发送预约链接给候选人（支持批量群发）
router.post('/send-candidate-link/:interviewId', async (req, res) => {
  try {
    const interview = get('SELECT * FROM interviews WHERE id = ?', [req.params.interviewId]);
    if (!interview) return res.status(404).json({ success: false, error: '面试记录不存在' });
    if (interview.status === 'pending_interviewer') {
      return res.status(400).json({ success: false, error: '面试官尚未设置时间' });
    }

    const { recipients } = req.body;
    // 兼容旧的单发模式
    let emailList = [];
    if (recipients && Array.isArray(recipients)) {
      emailList = recipients;
    } else if (req.body.recipient_email) {
      emailList = [{ email: req.body.recipient_email, name: req.body.recipient_name || '' }];
    }
    if (!emailList.length) return res.status(400).json({ success: false, error: '请提供收件人邮箱' });

    const baseUrl = getBaseUrl(req);
    const link = `${baseUrl}/schedule/${interview.candidate_token}`;
    const transporter = getTransporter();

    const results = { success: [], failed: [] };

    for (const r of emailList) {
      if (!r.email) continue;
      try {
        await transporter.sendMail({
          from: `"面试预约系统" <${process.env.SMTP_USER}>`,
          to: r.email,
          subject: `【面试邀请】请选择您方便的面试时间 - ${interview.position}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2 style="color:#1a1a1a;">您好${r.name ? '，' + r.name : ''}</h2>
              <p style="color:#444;line-height:1.7;">
                感谢您参与 <strong>${interview.position}</strong> 岗位的面试。<br>
                面试官 <strong>${interview.interviewer_name}</strong> 已设置了若干可选时间段，请点击下方按钮选择您方便的时间。<br>
                <strong style="color:#A32D2D;">注意：时间段先到先得，已被他人选择的时间段将不可选。</strong>
              </p>
              <div style="margin:32px 0;">
                <a href="${link}" style="background:#0F6E56;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:15px;">
                  选择面试时间
                </a>
              </div>
              <p style="color:#888;font-size:13px;">
                或复制此链接到浏览器打开：<br>
                <a href="${link}" style="color:#0F6E56;">${link}</a>
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
              <p style="color:#aaa;font-size:12px;">此邮件由面试预约系统自动发送，请勿回复。</p>
            </div>
          `
        });
        results.success.push(r.email);
      } catch (err) {
        console.error(`发送给 ${r.email} 失败:`, err.message);
        results.failed.push({ email: r.email, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `已发送 ${results.success.length} 封邮件${results.failed.length ? `，${results.failed.length} 封失败` : ''}`,
      results
    });
  } catch (err) {
    console.error('邮件发送失败:', err);
    res.status(500).json({ success: false, error: '邮件发送失败: ' + err.message });
  }
});

// 面试预约确认后通知面试官和候选人
router.post('/send-booking-confirmation/:bookingId', async (req, res) => {
  try {
    const booking = get('SELECT * FROM bookings WHERE id = ?', [req.params.bookingId]);
    if (!booking) return res.status(404).json({ success: false, error: '预约记录不存在' });

    const interview = get('SELECT * FROM interviews WHERE id = ?', [booking.interview_id]);
    const slot = get('SELECT * FROM time_slots WHERE id = ?', [booking.slot_id]);
    const dateStr = `${slot.date} ${slot.start_time} - ${slot.end_time}`;
    const baseUrl = getBaseUrl(req);
    const transporter = getTransporter();

    // 通知面试官
    await transporter.sendMail({
      from: `"面试预约系统" <${process.env.SMTP_USER}>`,
      to: interview.interviewer_email,
      subject: `【面试确认】${booking.candidate_name} 已预约面试`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;">您好，${interview.interviewer_name}</h2>
          <p style="color:#444;line-height:1.7;">
            候选人 <strong>${booking.candidate_name}</strong> 已确认面试时间：
          </p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin:20px 0;">
            <p style="margin:0;font-size:16px;font-weight:500;color:#1a1a1a;">${dateStr}</p>
            <p style="margin:8px 0 0;color:#666;font-size:13px;">
              职位：${interview.position}<br>
              候选人：${booking.candidate_name}（${booking.candidate_email}）
            </p>
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="color:#aaa;font-size:12px;">此邮件由面试预约系统自动发送，请勿回复。</p>
        </div>
      `
    });

    // 通知候选人
    await transporter.sendMail({
      from: `"面试预约系统" <${process.env.SMTP_USER}>`,
      to: booking.candidate_email,
      subject: `【面试确认】${interview.position} 面试时间已确认`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;">您好，${booking.candidate_name}</h2>
          <p style="color:#444;line-height:1.7;">
            您的面试时间已确认：
          </p>
          <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin:20px 0;">
            <p style="margin:0;font-size:16px;font-weight:500;color:#1a1a1a;">${dateStr}</p>
            <p style="margin:8px 0 0;color:#666;font-size:13px;">
              职位：${interview.position}<br>
              面试官：${interview.interviewer_name}
            </p>
          </div>
          <p style="color:#444;line-height:1.7;">请准时参加，祝面试顺利！</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="color:#aaa;font-size:12px;">此邮件由面试预约系统自动发送，请勿回复。</p>
        </div>
      `
    });

    res.json({ success: true, message: '确认邮件已发送' });
  } catch (err) {
    console.error('确认邮件发送失败:', err);
    res.status(500).json({ success: false, error: '邮件发送失败: ' + err.message });
  }
});

module.exports = router;
