const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/user');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');

const app = express();
const secretKey = 'your_secret_key';

// Cấu hình multer để upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'upload/'); // Thư mục lưu trữ file upload
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // Đặt tên file duy nhất
  },
});

const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json()); // Xử lý JSON body từ request

// Cung cấp file tĩnh trong thư mục uploads
app.use('/upload', express.static(path.join(__dirname, 'upload')));

// Kết nối tới MongoDB
mongoose.connect('mongodb+srv://tungonlytop1:luongsonbac123@cluster0.e0xqm.mongodb.net/medDiscussDB?retryWrites=true&w=majority')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Route đăng ký tài khoản
app.post('/api/register', upload.fields([
  { name: 'certificate', maxCount: 1 },
  { name: 'medicalHistoryFile', maxCount: 1 }
]), async (req, res) => {
  const { username, password, occupation, medicalHistory } = req.body;
  const isDoctor = occupation === 'Doctor';

  try {
    // Nếu là bác sĩ, yêu cầu chứng chỉ
    if (isDoctor && !req.files['certificate']) {
      return res.status(400).json({ message: 'Certificate is required for doctors' });
    }

    // Nếu không phải bác sĩ, yêu cầu lịch sử bệnh án
    if (!isDoctor && !medicalHistory) {
      return res.status(400).json({ message: 'Medical history is required for non-doctors' });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo người dùng mới
    const newUser = new User({
      username,
      password: hashedPassword,
      occupation,
      isDoctor,
      certificate: isDoctor ? req.files['certificate'][0].path : null, // Lưu đường dẫn chứng chỉ
      medicalHistory: !isDoctor ? medicalHistory : null, // Lưu lịch sử bệnh án
    });

    await newUser.save();
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route đăng nhập
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Tìm người dùng theo username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    // Tạo JWT token
    const token = jwt.sign({ id: user._id, username: user.username }, secretKey, { expiresIn: '1h' });

    res.status(200).json({
      message: 'Login successful',
      token,
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: error.message });
  }
});


// Middleware xác thực JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).json({ message: 'No token provided' });
  }

  jwt.verify(token.split(' ')[1], secretKey, (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user; // Lưu thông tin user trong request
    next();
  });
};

app.post('/api/verify-token', authenticateToken, (req, res) => {
  res.status(200).json({ valid: true });
});

// Route yêu cầu đăng nhập
app.get('/api/protected-route', authenticateToken, (req, res) => {
  res.status(200).json({
    message: 'You have accessed a protected route!',
    user: req.user,
  });
});

// Route lấy thông tin Profile người dùng
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      username: user.username,
      occupation: user.occupation,
      isDoctor: user.isDoctor,
      certificate: user.certificate,
      medicalHistory: user.medicalHistory,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Khởi chạy server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
