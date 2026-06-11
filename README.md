# 面试预约系统

## 快速启动

```bash
cd interview-scheduler
npm install
node server.js
```

服务启动后访问 `http://localhost:3000`

## 配置邮件（可选）

创建 `.env` 文件（复制 `.env.example`），填写邮件服务配置：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your@qq.com
SMTP_PASS=your_auth_code   # QQ邮箱需用授权码，非登录密码
BASE_URL=http://localhost:3000
PORT=3000
```

> 不配置邮件也可正常使用，手动复制链接发给相关人员即可。

## 使用流程

1. **HR** 打开 `http://localhost:3000`，点击「新建面试邀请」，填写职位、面试官和候选人信息
2. **HR** 在操作面板复制「面试官设时间链接」，发送给面试官（或点击「发送邮件」自动发送）
3. **面试官** 打开链接，填写自己方便的时间段，点击提交
4. **HR** 看到状态变为「等待候选人选择」后，复制「候选人预约链接」发给候选人
5. **候选人** 打开链接，从面试官提供的时间段中选择一个，确认预约
6. 双方自动收到确认邮件（需配置 SMTP）

## 项目结构

```
interview-scheduler/
├── server.js          # 主服务
├── db/
│   └── database.js    # SQLite 数据库（sql.js）
├── routes/
│   ├── interviews.js  # 面试记录 API
│   ├── slots.js       # 时间段 API
│   └── email.js       # 邮件发送 API
└── public/
    ├── css/style.css
    └── pages/
        ├── hr-dashboard.html   # HR 后台
        ├── interviewer.html    # 面试官设时间
        └── candidate.html      # 候选人预约
```
