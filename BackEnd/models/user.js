const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  occupation: { type: String, required: true },
  isDoctor: { type: Boolean, default: false },
  medicalHistory: { type: String },
  certification: { type: String }, 
});

const User = mongoose.model('User', userSchema);

module.exports = User;
