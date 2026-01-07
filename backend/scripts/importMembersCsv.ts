import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

type Row = Record<string, string>;

function parseCsv(content: string): Row[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map(h => h.trim());
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const row: Row = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = (cols[j] ?? '').trim();
    }
    rows.push(row);
  }
  return rows;
}

function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('用法: ts-node scripts/importMembersCsv.ts <csvFilePath>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const content = readFileSync(file, 'utf8');
    const rows = parseCsv(content);
    if (rows.length === 0) {
      console.error('CSV 無資料');
      process.exit(1);
    }

    const seenCodes = new Set<string>();
    const duplicateCodes: string[] = [];

    for (const row of rows) {
      const name = row['name'] || row['Name'] || '';
      const memberCode = row['member_code'] || row['MemberCode'] || '';
      const districtCode = row['district_code'] || row['DistrictCode'] || '';

      if (!name) {
        console.warn('略過：缺少 name ->', JSON.stringify(row));
        continue;
      }

      let finalCode = memberCode;
      if (!finalCode && districtCode) {
        // 依 district 生成流水碼
        const seq = await prisma.memberSequence.upsert({
          where: { district_code: districtCode },
          create: { district_code: districtCode, next_seq: 2 },
          update: { next_seq: { increment: 1 } },
          select: { next_seq: true }
        });
        const current = seq.next_seq - 1; // 使用遞增前的序號
        finalCode = `${districtCode}-${String(current).padStart(4, '0')}`;
      }

      if (finalCode) {
        if (seenCodes.has(finalCode)) duplicateCodes.push(finalCode);
        seenCodes.add(finalCode);
      }

      const key = normalizeKey(name);

      await prisma.member.upsert({
        where: { id: finalCode || key }, // 如果有 member_code 用作主鍵策略，否則用規範化 key
        update: {
          name,
        },
        create: {
          id: finalCode || key,
          name,
        }
      });
    }

    if (duplicateCodes.length > 0) {
      console.warn('警告：CSV 內發現重複 member_code：', duplicateCodes.join(', '));
    }

    console.log(`匯入完成，共處理 ${rows.length} 筆。`);
  } catch (err: any) {
    console.error('匯入發生錯誤：', err?.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();