export const FONTFIX_GAME = {
  id: 'dissidia-012-thai-v4',
  name: 'Dissidia 012', platform: 'PSP',
  format: 'XDELTA', streaming: true, version: 'v4 TEST',
  cover: 'covers/Dissidia_012_Thai_v1.0.png',
  desc: 'รวมคำแปลข้อความและชื่อสกิลทับศัพท์ พร้อมแก้ฟอนต์ไทย รองรับ PSP / PSP Go ระบบตรวจไฟล์ต้นฉบับและเลือกแพตช์ให้อัตโนมัติ รุ่นทดลอง: ยังต้องยืนยันบนเครื่องจริง',
  sourceName: 'EUR FULL UNDUB, ไทย v1.3 หรือ Dissidia ไทย v3 TEST',
  sourceSize: 1741168640,
  sourceSha256: '5877d20b328f45315251c6c605230e3a442ca0bffb51f54e9750e27329650e6c',
  targetSize: 1775933440,
  targetSha256: '61f9abb26ff11b9c6a38546f700bfe7833eea56121f4be42a1dc63478591ef8b',
  outName: 'Dissidia_012_Thai_v4_TEST.iso',
  sources: [
    {name:'EUR FULL UNDUB', size:1741168640, sha256:'5877d20b328f45315251c6c605230e3a442ca0bffb51f54e9750e27329650e6c', patchUrl:'patches/FROM_EUR_FULL_UNDUB_TO_Dissidia_Thai_v4_TEST.xdelta', patchSha256:'fb8857a4f974118d515d860bc193b0d8cc02ca3690be5a768bea4e5836781f6c', patchSize:17997349},
    {name:'ไทย v1.3', size:1751244800, sha256:'2a466b3bae3a67745cb86df738ed4f0327898f72a373cfe278ba7e2b5d9569e6', patchUrl:'patches/FROM_Thai_v1.3_TO_Dissidia_Thai_v4_TEST.xdelta', patchSha256:'6002a0ded03d128f60e8619d963b09fd86b05e72cdd237863650078619e8415d', patchSize:11503452},
    {name:'Dissidia ไทย v3 TEST', size:1763250176, sha256:'61cc3932dba4d8ecc264c72e92192f90f5a47271b5ba2d05def9558a15a0448e', patchUrl:'patches/FROM_Thai_v3_TEST_TO_Dissidia_Thai_v4_TEST.xdelta', patchSha256:'af282301fff74428f2bb42f8be8b36847166fc069289381247f7a72d4aeba327', patchSize:89350}
  ]
};
