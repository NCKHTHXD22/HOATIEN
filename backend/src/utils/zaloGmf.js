// Zalo Group Messaging Feature (GMF v3.0) — tạo/xoá/list nhóm OA (port từ QUESON)
const axios = require("axios").default;
const ZaloConfigRepo = require("../repositories/mongo/ZaloConfigRepo");
const env = require("../config/env");

async function _get(url, params) {
  let token = await ZaloConfigRepo.getValidToken();
  if (!token) throw new Error("Zalo OA chưa cấu hình access token");
  const doReq = (t) => axios.get(url, { params, headers: { access_token: t } });
  let res = await doReq(token);
  if (res.data?.error === -216) {
    token = await ZaloConfigRepo.refreshAccessToken();
    if (token) res = await doReq(token);
  }
  return res.data;
}

async function _post(url, body) {
  let token = await ZaloConfigRepo.getValidToken();
  if (!token) throw new Error("Zalo OA chưa cấu hình access token");
  const doReq = (t) => axios.post(url, body, { headers: { access_token: t, "Content-Type": "application/json" } });
  let res = await doReq(token);
  if (res.data?.error === -216) {
    token = await ZaloConfigRepo.refreshAccessToken();
    if (token) res = await doReq(token);
  }
  return res.data;
}

async function getGroupsOfOA() {
  return _get("https://openapi.zalo.me/v3.0/oa/group/getgroupsofoa");
}

async function getGroupMembersV3(groupId) {
  const data = await _get("https://openapi.zalo.me/v3.0/oa/group/listmember", { group_id: String(groupId), offset: 0, count: 50 });
  return { members: data?.data?.members || [], raw: data };
}

// Tạo nhóm Zalo từ danh sách thành viên ban đầu. ZALO_ASSET_ID mặc định = ZALO_APP_ID.
async function createZaloGroup(name, memberIds, description = "") {
  const assetId = process.env.ZALO_ASSET_ID || env.ZALO_APP_ID;
  if (!assetId) throw new Error("Thiếu ZALO_ASSET_ID/ZALO_APP_ID trong .env");
  const data = await _post("https://openapi.zalo.me/v3.0/oa/group/creategroupwithoa", {
    group_name: String(name),
    group_description: String(description || name),
    asset_id: String(assetId),
    member_user_ids: memberIds.map(String),
  });
  if (data?.error !== 0) throw new Error(`Zalo error ${data?.error}: ${data?.message}`);
  return data?.data?.group_id;
}

async function deleteZaloGroup(groupId) {
  const data = await _post("https://openapi.zalo.me/v3.0/oa/group/delete", { group_id: String(groupId) });
  if (data?.error !== 0) throw new Error(`Zalo error ${data?.error}: ${data?.message}`);
  return true;
}

// Danh sách người đang chờ duyệt vào nhóm (GMF v3.0)
async function getPendingGroupMembers(groupId, offset = 0, count = 50) {
  const data = await _get("https://openapi.zalo.me/v3.0/oa/group/listpendinginvite", { group_id: String(groupId), offset, count });
  return { members: data?.data?.members || [], total: data?.data?.total || 0, raw: data };
}

// Duyệt người đang chờ vào nhóm (GMF v3.0)
async function acceptGroupJoinRequest(groupId, memberUserIds) {
  const data = await _post("https://openapi.zalo.me/v3.0/oa/group/acceptpendinginvite", { group_id: String(groupId), member_user_ids: memberUserIds.map(String) });
  if (data?.error !== 0) throw new Error(`Zalo error ${data?.error}: ${data?.message}`);
  return true;
}

// Từ chối người đang chờ vào nhóm (GMF v3.0)
async function rejectGroupJoinRequest(groupId, memberUserIds) {
  const data = await _post("https://openapi.zalo.me/v3.0/oa/group/rejectpendinginvite", { group_id: String(groupId), member_user_ids: memberUserIds.map(String) });
  if (data?.error !== 0) throw new Error(`Zalo error ${data?.error}: ${data?.message}`);
  return true;
}

module.exports = { getGroupsOfOA, getGroupMembersV3, createZaloGroup, deleteZaloGroup, getPendingGroupMembers, acceptGroupJoinRequest, rejectGroupJoinRequest };
