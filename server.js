require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, run, get, all } = require('./db/database');

const interviewRoutes = require('./routes/interviews');
const slotRoutes = require('./routes/slots');
const emailRoutes = require('./routes/email');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/interviews', interviewRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/email', emailRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/pages/hr-dashboard.html'));
});

app.get('/interviewer/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'interviewer.html'));
});

app.get('/schedule/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'candidate.html'));
});

async function start() {
  await getDb();
  app.listen(PORT, () => {
    console.log(`面试预约系统已启动: http://localhost:${PORT}`);
    console.log(`HR 后台: http://localhost:${PORT}/`);
  });
}

start().catch(console.error);
