const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Set to true to actually modify the database, false for dry run
const DRY_RUN = true;

async function cleanupDuplicateMembers() {
  console.log('--- BẮT ĐẦU QUÉT DỮ LIỆU ---');
  console.log(`Chế độ: ${DRY_RUN ? 'MÔ PHỎNG (Dry-run)' : 'CHẠY THẬT (Thực thi)'}`);

  // Fetch all members that have a phone number, including household
  const members = await prisma.member.findMany({
    where: {
      sdt: { not: null },
      sdt: { not: '' }
    },
    include: {
      household: true
    }
  });

  console.log(`Tìm thấy ${members.length} nhân khẩu có số điện thoại.`);

  // Group by sdt + hoTen (normalized)
  const groups = {};
  for (const member of members) {
    const normName = member.hoTen.trim().toLowerCase().replace(/\s+/g, ' ');
    const normPhone = member.sdt.trim();
    const key = `${normPhone}_${normName}`;
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(member);
  }

  let totalDupGroups = 0;
  let totalRecordsDeleted = 0;

  for (const [key, group] of Object.entries(groups)) {
    if (group.length > 1) {
      totalDupGroups++;
      
      // Sort to prioritize:
      // 1. laChuHo == true
      // 2. has household.to
      // 3. updatedAt (latest)
      group.sort((a, b) => {
        if (a.laChuHo !== b.laChuHo) return a.laChuHo ? -1 : 1;
        const aHasTo = !!a.household.to;
        const bHasTo = !!b.household.to;
        if (aHasTo !== bHasTo) return aHasTo ? -1 : 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

      const keptRecord = group[0];
      const dupRecords = group.slice(1);
      
      console.log(`\nPhát hiện nhóm trùng lặp: [SĐT: ${keptRecord.sdt}, Tên: ${keptRecord.hoTen}]`);
      console.log(` -> Giữ lại (ID: ${keptRecord.id}): ${keptRecord.hoTen} (Chủ hộ: ${keptRecord.laChuHo}, Tổ: ${keptRecord.household.to || 'Không'})`);
      
      // Merge missing fields and collect IDs to delete
      const fieldsToUpdate = {};
      const fieldsToCheck = ['zaloUserId', 'cccd', 'email', 'ngaySinh', 'gioiTinh'];
      
      for (const field of fieldsToCheck) {
        if (!keptRecord[field]) {
          // Find the first duplicate that has this field
          const sourceDup = dupRecords.find(d => d[field]);
          if (sourceDup) {
            fieldsToUpdate[field] = sourceDup[field];
          }
        }
      }
      
      const dupIds = dupRecords.map(d => d.id);
      console.log(` -> Sẽ XÓA ${dupIds.length} bản ghi: ${dupIds.join(', ')}`);
      
      if (Object.keys(fieldsToUpdate).length > 0) {
        console.log(` -> Sẽ ĐẮP THÊM dữ liệu vào bản ghi giữ lại:`, fieldsToUpdate);
      }

      if (!DRY_RUN) {
        await prisma.$transaction(async (tx) => {
          // 1. Update missing fields on keptRecord
          if (Object.keys(fieldsToUpdate).length > 0) {
            await tx.member.update({
              where: { id: keptRecord.id },
              data: fieldsToUpdate
            });
          }

          // 2. Transfer relationships
          for (const dupId of dupIds) {
            // RecipientGroupMember (must check if exists first to avoid unique constraint)
            const existingGroups = await tx.recipientGroupMember.findMany({
              where: { memberId: keptRecord.id }
            });
            const existingGroupIds = new Set(existingGroups.map(g => g.groupId));
            
            const dupGroups = await tx.recipientGroupMember.findMany({
              where: { memberId: dupId }
            });
            
            for (const dg of dupGroups) {
              if (!existingGroupIds.has(dg.groupId)) {
                await tx.recipientGroupMember.update({
                  where: { groupId_memberId: { groupId: dg.groupId, memberId: dupId } },
                  data: { memberId: keptRecord.id }
                });
                existingGroupIds.add(dg.groupId);
              } else {
                // Delete duplicate membership
                await tx.recipientGroupMember.delete({
                  where: { groupId_memberId: { groupId: dg.groupId, memberId: dupId } }
                });
              }
            }

            // NotificationRecipient
            await tx.notificationRecipient.updateMany({
              where: { memberId: dupId },
              data: { memberId: keptRecord.id }
            });

            // NotificationSend
            await tx.notificationSend.updateMany({
              where: { memberId: dupId },
              data: { memberId: keptRecord.id }
            });
          }

          // 3. Delete the duplicate members
          await tx.member.deleteMany({
            where: { id: { in: dupIds } }
          });
        });
        console.log(' -> (Thực thi) Đã xử lý xong nhóm này.');
      }
      totalRecordsDeleted += dupIds.length;
    }
  }

  console.log('\n--- KẾT QUẢ ---');
  console.log(`Tìm thấy ${totalDupGroups} nhóm bị trùng lặp.`);
  console.log(`Tổng số bản ghi sẽ/đã bị xóa: ${totalRecordsDeleted}.`);
}

cleanupDuplicateMembers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
