// State machine trong memory cho luồng chat phản ánh (timeout 10 phút). Tách riêng khỏi
// ZaloSession (tra cứu hộ khẩu) — kiểm tra state này TRƯỚC trong handleMessage.
const userStates = new Map();

function setState(userId, data) {
  userStates.set(userId, { ...data, ts: Date.now() });
  setTimeout(() => {
    const cur = userStates.get(userId);
    if (cur && cur.ts === userStates.get(userId)?.ts) userStates.delete(userId);
  }, 10 * 60 * 1000);
}

function getState(userId) {
  return userStates.get(userId) || null;
}

function clearState(userId) {
  userStates.delete(userId);
}

module.exports = { setState, getState, clearState };
