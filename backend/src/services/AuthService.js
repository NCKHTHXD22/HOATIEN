const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AdminUserRepo = require("../repositories/pg/AdminUserRepo");
const env = require("../config/env");

async function login(username, password) {
  const user = await AdminUserRepo.findByUsername(username);
  if (!user || !user.isActive) throw new Error("Tài khoản không tồn tại hoặc đã bị khóa");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Mật khẩu không đúng");

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, canSendNotification: user.canSendNotification },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  const { passwordHash: _, ...safeUser } = user;
  return { token, user: safeUser };
}

async function createUser({ username, password, hoTen, role, villageIds }) {
  const exists = await AdminUserRepo.findByUsername(username);
  if (exists) throw new Error("Username đã tồn tại");
  const passwordHash = await bcrypt.hash(password, 10);
  return AdminUserRepo.create({ username, passwordHash, hoTen, role }, villageIds);
}

async function changePassword(userId, oldPassword, newPassword) {
  const user = await AdminUserRepo.findById(userId);
  if (!user) throw new Error("Không tìm thấy tài khoản");
  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) throw new Error("Mật khẩu cũ không đúng");
  const passwordHash = await bcrypt.hash(newPassword, 10);
  return AdminUserRepo.update(userId, { passwordHash });
}

async function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = { login, createUser, changePassword, verifyToken };
